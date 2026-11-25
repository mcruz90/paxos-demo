# 06 — API & SSE Contract

*Verified against source 2026-07-02 (branch `project-review-hardening`).
Source of truth: [backend/main.py](../../backend/main.py) and
[backend/models/schemas.py](../../backend/models/schemas.py).*

## Generated wire types (ADR-0012)

The Pydantic models are the **authored** source of truth for this contract; the
frontend's TypeScript wire types are a **build product** generated from the
backend's OpenAPI schema, not hand-mirrored.

- `npm run api:dump` — [backend/tools/dump_openapi.py](../../backend/tools/dump_openapi.py)
  writes the deterministic (sorted-key) OpenAPI document to
  [openapi.json](../../openapi.json) at the repo root via `app.openapi()` (no
  server boot).
- `npm run api:types` — `openapi-typescript` generates
  [src/generated/api-types.d.ts](../../src/generated/api-types.d.ts) (checked
  in; the demo deploy has no backend at build time — ADR-0005).
- Both are regenerated and diff-checked in CI (the `wire-types-freshness` job,
  [08-deployment-ci.md](08-deployment-ci.md)) — a stale generated file fails the
  build, the same drift-gate role the anchor-join parity guard plays for
  fixtures.

The SSE event shapes below (`step`/`chunk`/`done`/`error`, `InitialPaDoneEvent`)
would be invisible to OpenAPI on their own — the streaming routes return
`StreamingResponse`, which has no response model. They are registered explicitly
from the same Pydantic models in
[backend/openapi_ext.py](../../backend/openapi_ext.py) so the generated types
include typed SSE events.

*Note (2026-07-06): the dump → generate → guard pipeline established the
generated types; [src/types.ts](../../src/types.ts) is not yet migrated to
them. The typed SSE client that consumes them now exists — see **Client
consumption** below.*

## Client consumption (frontend)

The streaming routes are **POST** `text/event-stream`, so the browser's native
`EventSource` (GET-only) cannot be used. The client
([src/lib/](../../src/lib/)) drives them with `fetch()` and a streamed body
reader instead:

- [src/lib/sse.ts](../../src/lib/sse.ts) — an incremental frame parser for the
  exact `event: <name>\ndata: <json>\n\n` shape below (CRLF-tolerant; handles
  frames split across, or packed into, one network chunk), plus an
  async-iterable adapter over a `fetch` Response body (`TextDecoder` with
  `stream: true`).
- [src/lib/api.ts](../../src/lib/api.ts) — typed route wrappers:
  `streamAppealGenerate` / `streamAppealResume` / `streamPaSubmit` each return
  an `AsyncIterable` of that route's discriminated event union (narrow on the
  `event` field); `getAuditRecords` / `getPendingReviews` are plain typed GETs.
- [src/lib/wire.ts](../../src/lib/wire.ts) — the single place that aliases
  `components["schemas"][…]` from the generated types; nothing else indexes the
  generated file.

**Auth (client → backend):** cookie-based — every request sends
`credentials: "include"` and **no `Authorization` header** (the browser never
holds the API secret). State-changing POSTs send the session CSRF token as
`X-CSRF-Token` when supplied. This is now wired end-to-end (Sprint FI Slice 4):
in **live mode** (`VITE_API_BASE_URL` set) the SPA logs in via
`login()`/`logout()`/`me()` (added to `api.ts`), holds the returned
`{user_id, csrf_token}` **in memory only** (never localStorage — PHI rule; the
session id itself is the httpOnly cookie), and drives the streaming routes with
that CSRF token. There is **no build-time API key in the frontend bundle** — the
`VITE_API_KEY`/Bearer-in-the-browser idea is rejected (that is exactly what the
BFF exists to prevent, ADR-0013). The Bearer scheme below is server-side only,
for service/CI callers.

**Error handling mirrors the contract:** a non-200 *before* the stream throws a
typed `ApiError`; an in-stream failure is delivered as a terminal `error`
**event** (yielded, then the iterable ends), never a throw. No reconnect/retry
logic — a dropped connection ends the iterable and the caller decides.

## Authentication — dual scheme (ADR-0013)

Every `/api/*` route is authorized on **EITHER** of two credentials, resolved
by the auth middleware **before body parsing** (a bad token gets `401`, never
`422`):

1. **Bearer** — `Authorization: Bearer <API_SECRET_KEY>`, the service/CI
   identity (smoke-tour, evals, CI). Unchanged from the original scheme;
   compared with `hmac.compare_digest`. **CSRF-exempt** (not browser-driven).
2. **Session cookie** — `paxos_session`, an opaque httpOnly/Secure/SameSite=Strict
   cookie issued by `POST /api/auth/login`. For the **browser** SPA (FastAPI is
   its own BFF). A cookie-authenticated **non-GET** request must also carry an
   `X-CSRF-Token` header matching the session's token (double-submit CSRF
   defense) or it gets `403`.

The middleware resolves the caller's identity onto `request.state.session_user_id`
(the cookie's `user_id`, or `""` for a Bearer/service caller) so a route can
attribute an action without re-parsing auth (see `reviewed_by`, below). It also
resolves the caller's **`TenancyScope`** onto `request.state.tenancy_scope`
([ADR-0017](adr/0017-tenancy-patient-assignment.md)): a Bearer/service caller is
**platform-plane** (sees every tenant); a cookie session is scoped to its
`tenant_id` claim; the pre-auth default is **fail-closed** (no tenant, no rows).
The tenant-scoped read paths read this value — see the two introspection GETs.

`POST /api/auth/login` is the **one unauthenticated `/api/*` route** — it issues
the credential, so it cannot require it (justified per CLAUDE.md §Security
Defaults). Sessions live in a pre-DB in-memory store (`security/sessions.py`),
fixed 30-min TTL checked on read, single-worker only — same caveat as the audit
list ([ADR-0009](adr/0009-idempotency-key-and-audit-writes.md)).

## Routes

### `GET /health`

Unauthenticated. Returns `{"status": "ok"}`. Used by load balancers and CI
smoke tests.

### `POST /api/auth/login` — issue a session cookie (Slice 2)

**Unauthenticated** (credential-issuing). Body `LoginRequest`
`{username, password}` (strict Pydantic), checked constant-time against the
`DEMO_USER`/`DEMO_PASSWORD` env vars. On success: sets the `paxos_session`
cookie and returns `200` `LoginResponse` `{user_id, csrf_token}` — the
`csrf_token` is returned in the **body** (not the cookie) so the SPA can echo it
in `X-CSRF-Token`. Wrong credentials → `401`, no cookie.

### `POST /api/auth/logout` — destroy the session (Slice 2)

Requires a session (+ `X-CSRF-Token`, being a cookie write). Deletes the
server-side session and clears the cookie. `204`, no body.

### `GET /api/auth/me` — current session's user (Slice 2)

Requires a session. Returns `200` `MeResponse` `{user_id}`, or `401` if there is
no valid session.

### `POST /api/appeal/generate`

Streams an appeal letter as Server-Sent Events.

**Auth:** dual scheme — Bearer key OR `paxos_session` cookie (see
[Authentication](#authentication--dual-scheme-adr-0013)). Cookie writes to this
route require `X-CSRF-Token`; Bearer requests do not. Adding any unauthenticated
`/api/*` route requires explicit justification in the PR (CLAUDE.md §Security
Defaults).

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
checks whether the reviewed letter can be cleared. **Auth:** dual scheme (Bearer or cookie); a
cookie write needs `X-CSRF-Token`. **No LLM in this path** — resume re-enters
the graph at the `hold` node (no synthesis re-run), so the route serves without
`LLM_BACKEND` set and the stream carries no `chunk` events.

**Request body:** `ResumeAppealRequest` — strict-mode Pydantic:

| Field | Type | Constraint |
| --- | --- | --- |
| `correlation_id` | str | 1–200 chars — the parked run's handle (the `correlation_id` on its `done` event = its checkpoint `thread_id`) |
| `edited_text` | str \| null | ≤ 20000 chars, default `null` — the human-reviewed letter body; `null` clears the machine draft as-is |

**Events.** A changed letter runs through the same deterministic gatekeeper as the draft.
A passing edit returns `done` with `resume_gate=edit_passed`. A rejected edit returns
`error` with `resume_gate=edit_failed` and the gate reason in `message`. The original
draft remains parked and available in the review queue. An omitted, null, empty or
byte-identical edit approves that original draft and returns `done` with
`resume_gate=draft_reused`. The terminal carries the parked run's correlation ID.
An unknown or completed reference returns an error and writes no audit record.

**Audit.** Each resume verdict records `resume_gate` separately from human provenance
(`human_edited` or `human_approved`). Successful sign-off keeps the
`<correlation_id>:resume` key. Rejections record a failed gate under that key suffixed
with `:rejected:<SHA-256 of edited text>` so identical retries deduplicate and a
later sign-off has its own record.

**Actor attribution ([ADR-0013](adr/0013-fastapi-bff-session-cookie-auth.md)):**
a **cookie-authenticated** resume stamps the session's `user_id` on the resume
record's `reviewed_by`; a **Bearer-authenticated** resume leaves `reviewed_by=""`
(the service identity has no named human reviewer — recording one would be a
false accountability record).

### `GET /api/audit/records` — list the audit trail (S3 Task 3)

Read-only introspection over the in-memory audit store. **Auth:** dual scheme —
Bearer key or `paxos_session` cookie (ADR-0013), same as every other `/api/*`
route. **Tenant-scoped** (ADR-0017): a cookie session sees only its own tenant's
records; a Bearer/platform caller sees every tenant. Scoping is enforced at the
store's query boundary (`all_records` takes a required `TenancyScope` — no scope,
no rows), not in the handler. Returns matching `AuditRecord`s as-is —
**identifiers and hashes only, never letter/request text** (the records are
metadata by construction, ADR-0009); each carries `tenant_id` + optional
`patient_ref` (ADR-0017).

**Response:** `200` `application/json`, `AuditRecordsResponse`:

```json
{"records": [ { /* AuditRecord */ }, ... ]}
```

Order is insertion order (each run's boundary write, ADR-0009). Empty list
before any run. Not paginated pre-DB (in-process list; ADR-0009 note).

### `GET /api/reviews/pending` — parked runs awaiting human review (S3 Task 3)

Read-only. Lists the exception-tier runs parked at the `hold` checkpoint and
not yet cleared by a resume. **Auth:** dual scheme — Bearer key or `paxos_session`
cookie (ADR-0013). **Tenant-scoped** (ADR-0017): the queue reads through the same
fail-closed store boundary as the audit listing, so a session sees only its
tenant's parked runs, a platform caller all. **Metadata only** — never the draft
body (a reviewer-reads-the-draft surface is a deferred Slice 4c decision).

The queue is **derived from the audit trail**, not a separate structure: a
`correlation_id` is pending iff it has an exception-tier `done` audit record,
no successful `human_edited` record for the same id, and is still parked at its checkpoint
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
- A run **disappears** from this list after successful review or once its checkpoint is gone; an unknown/never-parked
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

**Events.** After the `crd_check` step, a PA that requires submission emits
`assemble`, `pas_submit`, and one `determination` step. A CRD early exit skips
those three steps. A pending determination ends the submission with a `done`
event. Repeating the same request with unresolved evidence returns the same
`pended` outcome. The stream emits exactly one terminal event.

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
  cites no payer-specific criteria (a policy hold). `drug_alias` appears only in
  historical records: the drug had a pack under another plan, whose criteria are
  not used (ADR-0019). Both route to the exception tier.
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
| 200 | Streaming routes: stream started (application outcome is in-stream). Introspection GETs (`/api/audit/records`, `/api/reviews/pending`): the JSON body. `POST /api/auth/login`, `GET /api/auth/me`: the JSON body |
| 204 | `POST /api/auth/logout` — session destroyed, no body |
| 401 | No valid credential — missing/invalid Bearer token, missing/expired session cookie, or bad login credentials (`{"detail": …}`) |
| 403 | Cookie-authenticated non-GET without a matching `X-CSRF-Token` (`{"detail": "Missing or invalid CSRF token"}`) |
| 422 | Body failed request-model validation (FastAPI standard shape) |

## Environment variables

Source of truth: [backend/.env.example](../../backend/.env.example).
`main.py` calls `load_dotenv()`; real env vars win over `.env`.

| Var | Required | Meaning |
| --- | --- | --- |
| `API_SECRET_KEY` | yes | Bearer token for `/api/*`, service/CI identity (cached on first read) |
| `DEMO_USER` / `DEMO_PASSWORD` | for cookie login | Demo browser credentials checked by `POST /api/auth/login` (constant-time); pre-DB single-user store ([ADR-0013](adr/0013-fastapi-bff-session-cookie-auth.md)) |
| `CORS_ORIGINS` | no | Comma-separated browser origin allowlist; default `http://localhost:5173`. `allow_credentials=True`, so `*` is not permitted |
| `LLM_BACKEND` | yes | `mock` or `groq` — **no default**, unset fails loudly ([ADR-0002](adr/0002-provider-neutral-llm-backend.md)) |
| `GROQ_API_KEY` | when `groq` | Provider key |
| `GROQ_MODEL` | no | Default `llama3-8b-8192` |
| `LLM_TIMEOUT_SECONDS` | no | Remote-provider request timeout, default 30 |
| `VITE_API_BASE_URL` | frontend | **Opt-in live mode.** Set (e.g. `http://localhost:8000`) → the SPA calls the real backend via cookie/CSRF auth (Sprint FI Slice 4). Unset → the simulated demo runs fully offline. **No API key is ever put in the frontend bundle** — cookie/CSRF replaces the rejected `VITE_API_KEY`/Bearer-in-browser idea (ADR-0013) |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | — | **Deferred** — langfuse is not installed ([ADR-0007](adr/0007-deferred-dependencies.md)) |

CORS is a `CORS_ORIGINS` allowlist with `allow_credentials=True` (cookies) —
tightened from `["*"]` in Slice 2 ([ADR-0013](adr/0013-fastapi-bff-session-cookie-auth.md)),
since a browser will not send credentials to a wildcard origin.

## Durable patient case metadata (local integration increment)

| Method | Path | Result |
|---|---|---|
| POST | `/api/patients/{patient_ref}/cases` | `CaseRecord` after commit; body contains only `idempotency_key` |
| GET | `/api/patients/{patient_ref}/cases/{case_id}` | Current scoped `CaseRecord` |
| GET | `/api/patients/{patient_ref}/cases/{case_id}/events` | Stored `CaseEventRecord[]`, ordered by `event_sequence` |

All three require a browser session and an active durable group/patient grant;
POST additionally requires CSRF. Bearer service credentials alone receive 401.
Tenant/subject are resolved from session state, actor from the durable principal.
The path patient is checked against the panel, never treated as authorization.
Case ids are canonical UUIDv4. Extra body fields are rejected with 422. POST
returns 200 for both first creation and identical replay; replay preserves the
original creation revision. Reuse for another authorized patient returns 409.
Missing case or grant is 404. Storage/commit failure is a metadata-only 503.

The public event sequence is a stable allocation key, not commit order, a gapless
count or a global incremental-consumption cursor. This increment still permits
only case_created at revision 1. No evidence, artifacts, approvals or exports are
exposed here. See [runtime contracts](14-case-evidence-runtime.md) for transaction,
revocation and provisioning boundaries. The application database is not migrated
by server startup, and these routes have not been wired to the UI.

## Case discovery and attachments

All paths below extend `/api/patients/{patient_ref}/cases/{case_id}`. Each operation requires a session and a current patient-panel grant. Writes also require the session CSRF header and an integer `expected_revision` between 1 and 9223372036854775807. Additional body fields are rejected.

| Method and path | Request | Success (200) |
|---|---|---|
| POST `/discovery` | `query` (0–256 characters), `expected_revision`, optional `request_id` | Persisted query ID, query, revision and ordered items |
| GET `/discovery` | Optional `limit` (1–50, default 50) | Newest queries first with ID, text, revision, creation time and item count. Older queries without recorded times appear last. |
| GET `/discovery/{query_id}` | — | Original query and items |
| POST `/attachments` | `result_id`, `request_id`, `expected_revision` | Attachment ID, exact item, actor ID and timestamp |
| DELETE `/attachments/{attachment_id}` | JSON body with `request_id`, `expected_revision` | Original attachment, now removed from the active list |
| GET `/attachments` | — | Active attachments in timestamp and ID order |

A blank query lists the bound fixture corpus. A nonblank query does case-insensitive substring matching across title, category and available text. An unbound case returns an empty result set. Use the result ID to select one item. For `full_text`, `[start, end)` indexes Unicode code points and `content_sha256` hashes the UTF-8 note. For `metadata_only`, the digest hashes the visible title and the span and excerpt are null.

Search accepts an optional request ID. An identical keyed search replays the original snapshot even if the case revision has advanced. Omitting the ID creates a fresh snapshot.

Attachment commands require a request ID of 1–128 letters, digits or characters from `._:-`. Repeating the same attach or remove returns the original response. Changing the query text, attachment target or operation, or expected revision under the same scoped ID returns 409 with `code=idempotency_conflict`. A new write against a stale revision returns 409 with `code=stale_case_revision`. Both retain `detail=case_conflict`. An inaccessible case, query, result or attachment yields 404. Malformed bodies yield 422. Attaching or removing evidence preserves the assessment response. [ADR 0022](adr/0022-discovery-attachments.md)

### Case assessment and partial approval

`GET /api/patients/{patient_ref}/cases/{case_id}/assessment` reads the scoped
case revision. For the bound pediatric anchor, `duration_approval` records the
original request in milligrams per day and once-daily doses, both durations in
days, and the dated determination with its source and excerpt. The payer's
authorization period has its own quote and policy location. Initial-PA
readiness and pathway continue to describe the original coverage criteria.

The appeal history records the filing date, upheld date and peer-to-peer offer.
Each fact points to its own field in the synthetic pediatric seed through
`appeal_date_source`, `upheld_date_source` and `peer_to_peer_offered_source`.
The top-level `next_action` addresses the remaining duration. With a documented
fill, `supply_end_date` is the last covered day (fill day counts as day one).
Without a documented fill, both fill and supply end dates are null and staff
are asked to confirm the fill date. The label check is pending. Cases without
an applicable finding return `duration_approval: null`.

### Synthetic dose review

The case assessment can include an optional `dose_review` for the separately
bound E-01 case. Set `DOSE_FIXTURE_CASE_ID` to the server-created case ID for
synthetic patient PT-4202 in the seeded tenant. The reader checks revision 1.
A documented difference between once-daily doses yields a staff review hold
with separate prescription, determination letter and policy citations. When
the applicable Quantity Limits section cannot be verified, the finding says so
and the policy citation is null. The review includes one draft written question
for the assigned case reviewer. A payer reply requires reconciliation. Reading
the assessment sends nothing and creates no events. Matching doses omit the
field, including a shorter approved duration. Initial-PA readiness is independent.
