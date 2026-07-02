# ADR-0006: SSE transport with a guaranteed terminal event

- **Status:** Accepted
- **Date:** 2026-07-02 (backfilled; terminal-event guarantee added as hard-2)
- **Decided by:** May

## Context

Appeal generation is a multi-second LLM streaming task; the POC UI shows
pipeline progress (step transitions) and letter text as it arrives. Options
were WebSockets, HTTP polling, or Server-Sent Events.

A separate discovery sharpened the decision: SSE response headers are sent
before the pipeline runs, so a mid-stream node exception used to kill the
connection with **no** event — the client saw a bare disconnect and the typed
exceptions in `errors.py` surfaced nowhere (hard-2 in
[/docs/project-review-hardening.md](../../project-review-hardening.md)).

## Decision

- **Transport is SSE** (`text/event-stream` on `POST /api/appeal/generate`):
  the flow is strictly server→client, so WebSockets buys nothing but
  connection-state complexity, and polling can't stream tokens. Headers
  include `Cache-Control: no-cache` and `X-Accel-Buffering: no` (disables
  proxy buffering).
- **Events are a typed discriminated union** (`AppealEvent` =
  `StepEvent | ChunkEvent | DoneEvent | ErrorEvent`), Pydantic-defined in
  `models/schemas.py`, serialized as `event: <type>\ndata: <json>\n\n`.
- **Every stream terminates with `done` or `error` — guaranteed.** Two
  wrap points enforce it: `main.py._stream_events` converts LLM-backend
  construction failure into an `ErrorEvent`, and `graph.run_pipeline` wraps
  the pipeline body so a node exception becomes an `ErrorEvent` (detail
  logged server-side, identifiers only; generic message to the client).
  These are the only deliberate broad catches in the codebase.

## Consequences

- Clients need no timeout-guessing: absence of a terminal event now means
  transport failure, not application failure — reconnect logic can be dumb.
- POST-based SSE means the browser-native `EventSource` API (GET-only) isn't
  used; the client reads the stream via `fetch`. Acceptable — the POC view
  already does this.
- Idempotency on reconnect (client retries must not double-generate/
  double-audit) is a CLAUDE.md requirement that lands with the AuditRecord
  wiring — see [10-roadmap-traceability.md](../10-roadmap-traceability.md).
