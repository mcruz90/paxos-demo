# ADR-0011: The audit trail is the parked-run review-queue index

- **Status:** Accepted
- **Date:** 2026-07-04
- **Decided by:** May + Claude Code (S3 Task 3)

## Context

`GET /api/reviews/pending` must list the exception-tier runs parked at the
`hold` checkpoint awaiting human review (S3 Slice 4a/4b, ADR-0010). The
question was where that queue lives. Two shapes were on the table:

1. **A second, purpose-built queue** — a list/table the `hold` node appends to
   on park and `run_resume` removes from on clear.
2. **Derive the queue from state we already keep** — the audit trail plus the
   checkpointer, with no new mutable structure.

A separate queue is a second source of truth for "what is awaiting review"
that can drift from the audit trail and the checkpointer (park succeeds but the
queue-append fails; resume clears the checkpoint but not the queue). It would
also need its own idempotency + reset semantics, duplicating what the audit
store and checkpointer already guarantee. Every audit write already happens at
the pipeline boundary before the terminal event (ADR-0009), and every parked
run already has a live checkpoint keyed by `correlation_id` (ADR-0010).

## Decision

We will **derive the pending-review queue from the audit trail, confirmed
against the checkpointer** — no separate queue structure.

A `correlation_id` is pending review iff:

1. it has an **exception-tier `done`** audit record (the parked draft — tier is
   a property of a produced artifact; error runs carry `tier=None` and never
   qualify), AND
2. **no `human_edited` record** exists for the same `correlation_id` (the
   durable "was reviewed and cleared" marker written by `run_resume`), AND
3. the run is **still parked**, confirmed via the checkpointer's public
   `_PIPELINE.get_state(config).next` — the *same* check `run_resume` uses in
   [agents/resume.py](../../../backend/agents/resume.py). We never crawl
   `InMemorySaver` internals.

The derivation is a pure function over `(records, is_parked)` in
[agents/review_queue.py](../../../backend/agents/review_queue.py) — the `api/`
handler stays logic-free (CLAUDE.md §File Organization), and the derivation is
unit-tested with literal records and a fake `is_parked`, no live checkpointer.

Filters (2) and (3) are deliberately belt-and-suspenders. The `human_edited`
record is the durable signal (it survives independently of checkpoint state);
`is_parked` guards against an audit record whose checkpoint is gone (e.g. a
future eviction policy) so a run whose checkpoint cannot actually be resumed is
never advertised as resumable.

## Consequences

- **No drift, no new idempotency surface.** "What is awaiting review" has one
  derivation, not a second structure to keep in sync with the audit store and
  checkpointer. Park/resume already maintain both inputs correctly.
- **The queue is exactly as durable as its inputs** — today an in-process
  audit list + `InMemorySaver`, both reset on restart, both sharding under
  multiple uvicorn workers (ADR-0009/0010). Acceptable pre-DB.
- **Survives the Phase 3 PostgreSQL swap.** The audit store and the
  checkpointer move to durable storage *together* (ADR-0009/0010), and the
  derivation depends only on their public surfaces (`all_records()`,
  `get_state().next`) — not on which backend implements them. The pure function
  does not change; only `is_run_parked` is repointed at the durable
  checkpointer.
- **Listing cost is O(records).** Fine at pre-DB volumes; when the audit store
  becomes a database, `pending` becomes an indexed query (exception-tier `done`
  rows without a `human_edited` sibling) rather than a full scan — the same
  predicate, pushed down.
- Read-only introspection endpoints are now part of the API surface — see
  [06-api-contract.md](../06-api-contract.md); the layer wiring is in
  [02-backend-architecture.md](../02-backend-architecture.md).
