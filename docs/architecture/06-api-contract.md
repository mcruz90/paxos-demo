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

### Initial-PA lifecycle route — **spec-first, route lands in S2 Slice 5**

The request/event schemas exist as of S2 Slice 1
(`InitialPaRequest`, `InitialPaDoneEvent`, `InitialPaEvent` in
[schemas.py](../../backend/models/schemas.py)); no route serves them yet.
Contract the Slice 5 endpoint will honor: Bearer auth like every `/api/*`
route; SSE with the same terminal guarantee (`done`|`error`); `step` events
for the initial-PA nodes; **no `chunk` events** (no LLM in this path); the
`done` payload is `InitialPaDoneEvent` (CRD result, determination,
appeal-handoff pointer when denied) rather than the appeal `DoneEvent`.
This section becomes the route's full spec when Slice 5 lands.

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
| 200 | Stream started (application outcome is in-stream) |
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
