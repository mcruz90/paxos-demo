# 06 — API & SSE Contract

*Verified against source 2026-07-02 (branch `project-review-hardening`).
Source of truth: [backend/main.py](../../backend/main.py) and
[backend/models/schemas.py](../../backend/models/schemas.py).*

## Routes

### `GET /health`

Unauthenticated. Returns `{"status": "ok"}`. Used by load balancers and CI
smoke tests.

### `POST /api/appeal/generate`

Streams an appeal letter as Server-Sent Events.

**Auth:** `Authorization: Bearer <API_SECRET_KEY>` — enforced by middleware
on all `/api/*` paths **before body parsing** (a bad token gets `401`, never
`422`). Token comparison uses `hmac.compare_digest`. Adding any
unauthenticated `/api/*` route requires explicit justification in the PR
(CLAUDE.md §Security Defaults).

**Request body:** `AppealRequest` — strict-mode Pydantic (wrong types are
rejected, not coerced):

| Field | Type | Constraint |
| --- | --- | --- |
| `scenario_id` | str | ≤ 64 chars, `^[a-z0-9\-]+$` |
| `drug`, `diagnosis`, `plan` | str | ≤ 200 chars |
| `denial_text` | str | ≤ 5000 chars |
| `denial_reason` | str | ≤ 500 chars |
| `plan_id` | str | ≤ 100 chars |
| `criteria_results` | `CriterionResult[]` | see [03-domain-model.md](03-domain-model.md) |
| `company_names` | str[] | optional, default `[]` |
| `attempt` | int ≥ 1 | default 1 — deliberate-resubmission counter; part of the audit idempotency key ([ADR-0009](adr/0009-idempotency-key-and-audit-writes.md)). A transport retry reuses it; bump it to refile on purpose |
| `security_hold`, `security_reason` | bool, str | ETL-set; default `False`/`""` — clients shouldn't send them |

**Response:** `200` with `Content-Type: text/event-stream`,
`Cache-Control: no-cache`, `X-Accel-Buffering: no`. Note the 200 arrives
before the pipeline runs — application failures are in-stream `error`
events, not HTTP status codes.

### `POST /api/appeal/resume` — clear a parked exception run (S3 Slice 4b)

Resumes an exception-tier appeal run that parked for human review
([ADR-0010](adr/0010-in-memory-checkpointer-exception-interrupt.md)) and
drives it to a `done` terminal. **Auth:** same Bearer middleware. **No LLM in
this path** — resume re-enters the graph at the `hold` node (no synthesis
re-run), so the route serves without `LLM_BACKEND` set and the stream carries
no `chunk` events.

**Request body:** `ResumeAppealRequest` — strict-mode Pydantic:

| Field | Type | Constraint |
| --- | --- | --- |
| `correlation_id` | str | 1–200 chars — the parked run's handle (the `correlation_id` on its `done` event = its checkpoint `thread_id`) |
| `edited_text` | str \| null | ≤ 20000 chars, default `null` — the human-reviewed letter body; `null` clears the machine draft as-is |

**Events:** a single terminal `done` (same shape as the appeal route; `tier`
stays `exception`, `correlation_id` equals the parked run's — one saga, one
ID) or `error` when nothing is awaiting review for `correlation_id` (unknown,
or already resumed — resume is idempotent: a completed run cannot be resumed
again).

**Audit:** the resume writes its **own** `AuditRecord` —
`provenance=human_edited`, `idempotency_key=<correlation_id>:resume` (distinct
from the draft's `<case_id>:a<attempt>`, so the human sign-off is not deduped
against the machine draft; the two share one `correlation_id`). This is the
first deliberate divergence of correlation_id and idempotency_key that
[ADR-0009](adr/0009-idempotency-key-and-audit-writes.md) anticipated. A resume
of a non-parked reference is a client error and writes no record.

### `GET /api/audit/records` — list the audit trail (S3 Task 3)

Read-only introspection over the in-memory audit store. **Auth:** same Bearer
middleware. Returns every `AuditRecord` as-is — **identifiers and hashes only,
never letter/request text** (the records are metadata by construction, ADR-0009).

**Response:** `200` `application/json`, `AuditRecordsResponse`:

```json
{"records": [ { /* AuditRecord */ }, ... ]}
```

Order is insertion order (each run's boundary write, ADR-0009). Empty list
before any run. Not paginated pre-DB (in-process list; ADR-0009 note).

### `GET /api/reviews/pending` — parked runs awaiting human review (S3 Task 3)

Read-only. Lists the exception-tier runs parked at the `hold` checkpoint and
not yet cleared by a resume. **Auth:** same Bearer middleware. **Metadata
only** — never the draft body (a reviewer-reads-the-draft surface is a deferred
Slice 4c decision).

The queue is **derived from the audit trail**, not a separate structure: a
`correlation_id` is pending iff it has an exception-tier `done` audit record,
no `human_edited` record for the same id, and is still parked at its checkpoint
(confirmed via the checkpointer's public `get_state(...).next` — the same check
`run_resume` uses). See
[ADR-0011](adr/0011-audit-trail-as-review-queue-index.md).

**Response:** `200` `application/json`, `PendingReviewsResponse`:

```json
{
  "reviews": [
    {
      "correlation_id": "livdelzi-cigna:a1",
      "scenario_id": "livdelzi-cigna",
      "drug": "Livdelzi (seladelpar)",
      "plan": "Cigna PPO",
      "tier": "exception",
      "parked_at": "2026-07-04T09:30:00+00:00"
    }
  ]
}
```

- `tier` is always `exception` today (only that tier parks); carried
  explicitly so the shape survives if another tier ever gains a checkpoint.
- `parked_at` is the timestamp of the exception `done` audit record.
- A run **disappears** from this list once resumed (its `human_edited` record
  is written) or once its checkpoint is gone; an unknown/never-parked
  `correlation_id` never appears — the queue is not a crawl of stray
  checkpoints.

### `POST /api/pa/submit` — initial-PA lifecycle (S2 Slice 5)

Runs CRD check → assemble → PAS submit (stub rail) → determination as SSE.
**Auth:** same Bearer middleware as every `/api/*` route. **No LLM in this
path** — the route serves without `LLM_BACKEND` set, and the stream never
carries `chunk` events.

**Request body:** `InitialPaRequest` — strict-mode Pydantic, deliberately
NOT an `AppealRequest` extension (no denial fields):

| Field | Type | Constraint |
| --- | --- | --- |
| `scenario_id` | str | ≤ 64 chars, `^[a-z0-9\-]+$` |
| `case_ref` | str | ≤ 64 chars, `^[A-Za-z0-9\-]*$`, default `""` — client case reference; the idempotency/correlation case identity ([ADR-0009](adr/0009-idempotency-key-and-audit-writes.md)); falls back to `scenario_id` |
| `drug`, `diagnosis`, `plan`, `requested_therapy` | str | ≤ 200 chars |
| `plan_id` | str | ≤ 100 chars |
| `criteria_results` | `CriterionResult[]` | chart evidence attached to the submission |
| `attempt` | int ≥ 1 | default 1 — see ADR-0009 |
| `security_hold`, `security_reason` | bool, str | ETL-set; enforced at the pipeline gate before any node |

**Events:** `step` (`crd_check`, `assemble`, `pas_submit`, `determination` —
`determination` repeats on a pend cycle; `assemble` onward skipped when the
CRD early-exits), then exactly one terminal:

```json
{
  "event": "done",
  "pa_required": {"required": true, "basis": "Payer PA policy on file for plan CIGNA-CNF360-2024 covering Ozempic (semaglutide)."},
  "outcome": {"decision": "approved", "determinationId": "DET-PAS-…-1", "timeToTherapy": "3 business days (stub rail)", "note": "…"},
  "appeal_handoff": null,
  "submission_ref": "PAS-…",
  "pa_resolution": "plan_id",
  "correlation_id": "PA-2026-0847:a1"
}
```

- `outcome` is `null` ⇔ the CRD early-exited (`pa_required.required` false —
  no submission was made).
- `appeal_handoff` is present iff `outcome.decision == "denied"` — a
  **pointer** (`scenarioId`, `caseRef`); the appeal is never auto-launched.
- `error` terminal: same shape as the appeal route's.
- Every run writes exactly one `AuditRecord` before the terminal event
  (lifecycle `initial_pa`, `artifact_ref` = `submission_ref`).

## SSE wire format

Each event is one frame:

```
event: <step|chunk|done|error>
data: <JSON per the shapes below>

```

### `step` — node transition

```json
{"event": "step", "step": "ingestion", "label": "Validating request…"}
```

`step` values in order: `ingestion`, `retrieval`, `synthesis` (repeated per
retry attempt). The gatekeeper does not emit a step — it resolves into
`done`, another `synthesis`, or `error`.

### `chunk` — one streamed token/fragment of the letter

```json
{"event": "chunk", "text": "Dear "}
```

Concatenate `text` fields in arrival order to reconstruct the letter. On a
gatekeeper-triggered retry, a new `synthesis` step follows and new chunks
replace the previous attempt — clients should reset the letter buffer on
each `synthesis` step event.

### `done` — success terminal

```json
{
  "event": "done",
  "model": "mock-llm",
  "ref": "a1b2c3d4e5f6",
  "structural_scores": {
    "drug_name_present": 1.0,
    "diagnosis_present": 1.0,
    "denial_addressed": 1.0,
    "criteria_cited": 0.0,
    "min_length": 1.0
  },
  "pa_resolution": "plan_id",
  "retry_count": 0,
  "correlation_id": "ozempic-cigna-clinical-pa:a1"
}
```

- `ref` — first 12 hex chars of the SHA-256 of the letter text (audit
  reference).
- `structural_scores` — the five deterministic eval dimensions (0.0/1.0
  each); informational, not gating. May be `{}` if scoring itself failed.
- `pa_resolution` — `"plan_id" | "drug_alias" | "generic"` (or `""`):
  which retrieval path produced the PA context. `generic` means the letter
  cites no payer-specific criteria — downstream review should weight that.
- `retry_count` (S2 Slice 4, additive) — gatekeeper retries that preceded
  the pass.
- `correlation_id` (S2 Slice 4, additive) — the logical run's ID, equal to
  the AuditRecord's ([ADR-0009](adr/0009-idempotency-key-and-audit-writes.md)).

### `error` — failure terminal

```json
{"event": "error", "message": "…", "retry_count": 0, "correlation_id": "…"}
```

`correlation_id` is `""` only for pre-pipeline failures (backend
construction in `main.py`).

| Cause | `message` shape | `retry_count` |
| --- | --- | --- |
| LLM backend misconfigured (`LLM_BACKEND` unset/unknown, missing key) | `"Server LLM backend is not configured."` | 0 |
| Security hold | `"Request blocked by security hold: <reason>"` | 0 |
| Node exception (broad-catch boundary) | `"Appeal generation failed due to an internal error."` | 0 |
| Gatekeeper failed 3 attempts | `"Appeal generation failed after 3 attempts. <last check failure>"` | 3 |

**Terminal-event guarantee:** every stream ends with exactly one `done` or
`error` ([ADR-0006](adr/0006-sse-streaming-transport.md)). A connection that
drops without one is a transport failure — **safe to retry: the retried
request reuses the same `attempt`, maps onto the same idempotency key, and
never double-writes the audit trail**
([ADR-0009](adr/0009-idempotency-key-and-audit-writes.md)). Exactly one
`AuditRecord` is written per run, before the terminal event is emitted.

## HTTP status codes

| Code | Cause |
| --- | --- |
| 200 | Streaming routes: stream started (application outcome is in-stream). Introspection GETs (`/api/audit/records`, `/api/reviews/pending`): the JSON body |
| 401 | Missing/invalid Bearer token (`{"detail": "Missing or invalid Authorization header"}` or `{"detail": "Invalid API key"}`) |
| 422 | Body failed `AppealRequest` validation (FastAPI standard shape) |

## Environment variables

Source of truth: [backend/.env.example](../../backend/.env.example).
`main.py` calls `load_dotenv()`; real env vars win over `.env`.

| Var | Required | Meaning |
| --- | --- | --- |
| `API_SECRET_KEY` | yes | Bearer token for `/api/*` (cached on first read) |
| `LLM_BACKEND` | yes | `mock` or `groq` — **no default**, unset fails loudly ([ADR-0002](adr/0002-provider-neutral-llm-backend.md)) |
| `GROQ_API_KEY` | when `groq` | Provider key |
| `GROQ_MODEL` | no | Default `llama3-8b-8192` |
| `LLM_TIMEOUT_SECONDS` | no | Remote-provider request timeout, default 30 |
| `VITE_API_KEY` | frontend | Must equal `API_SECRET_KEY`; injected at build time into the POC client |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | — | **Deferred** — langfuse is not installed ([ADR-0007](adr/0007-deferred-dependencies.md)) |

CORS is currently `allow_origins=["*"]` — flagged in code to tighten at
deploy time.
