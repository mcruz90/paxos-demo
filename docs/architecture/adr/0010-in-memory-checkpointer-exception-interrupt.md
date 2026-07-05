# ADR-0010: In-memory checkpointer for the exception-tier interrupt

- **Status:** Accepted
- **Date:** 2026-07-04 (Sprint 3 Slice 4a)
- **Decided by:** May (sprint plan named the interrupt as Slice 4; the scoping
  fork — how much of the interrupt→resume round-trip to build now — was
  surfaced and staged into 4a/4b/4c; this ADR records the structural decision
  4a makes)

## Context

Slice 4 delivers the compliance-critical HITL primitive: an exception-tier run
must **park** so a human reviews the drafted appeal before it can proceed,
rather than running to completion and being forgotten. [ADR-0001](0001-langgraph-target-orchestrator.md)
committed to LangGraph precisely so this pause/resume comes from the framework
(`interrupt()` + a checkpointer), not hand-rolled state machinery.

Two existing constraints collide here and had to be reconciled:

1. **ACID §Isolation.** `agents/graph.py` deliberately compiled with **no
   checkpointer** so the module-level compiled graph is stateless across runs —
   each run gets its own isolated `PipelineState`, no shared mutable state
   ([02-backend-architecture.md](../02-backend-architecture.md) orchestration
   section). `interrupt()` **requires** a checkpointer. So enabling the
   interrupt reverses a documented design choice — a structural change, hence
   this ADR.
2. **SSE terminal contract** (CLAUDE.md §Defensive Programming): every stream
   ends with exactly one `done` or `error`. A LangGraph interrupt suspends the
   run mid-graph and does **not** naturally emit a terminal event.

The scoping fork ("keep minimal; full resume UX may slip to S4/S5") was staged
into three slices — **4a** (this ADR: checkpoint + interrupt, resume
test-proven), **4b** (the `POST /api/appeal/resume` endpoint), **4c** (frontend
HITL resume UX) — so the load-bearing structural decision lands and is reviewed
before the mechanical work stacks on it.

## Decision

1. **Compile the appeal graph with `InMemorySaver`.** Not the initial-PA graph
   (no exception interrupt there yet). This is the in-memory analogue of the
   pre-DB audit list — process-global, reset on restart.
2. **`thread_id = correlation_id`** (`case_id:aN`). The run's checkpoint is
   keyed by the same single ID that already names it in logs, the terminal SSE
   event, and the `AuditRecord` ([ADR-0009](0009-idempotency-key-and-audit-writes.md)).
   The resume handle is therefore the correlation_id — no new field is minted.
3. **Interrupt only on the exception tier, only after `finalize`.** A
   post-`finalize` conditional edge routes `exception → hold`, every other tier
   `→ END`. The `hold` node calls `interrupt()`. Because `finalize` has
   **already emitted the exception `DoneEvent`**, the SSE stream terminates with
   `done` *before* the pause — the terminal contract holds with **no new
   terminal type**. The interrupt surfaces on LangGraph's `updates` channel,
   which `stream_mode="custom"` does not forward, so the client's stream simply
   ends after the `done` event; the checkpoint is retained server-side.
4. **Isolation is preserved because the store is *keyed*, not shared-mutable.**
   Distinct runs have distinct `thread_id`s, so they never share checkpoint
   state. Reusing a `thread_id` is *only* how a deliberate resume/retry
   addresses the same logical run — the same principle as the idempotency key.
5. **The held run is audited as `done`** (`outcome=done`, `tier=exception`,
   `provenance=as_is`) at the `finalize` boundary — accurate: the pipeline
   produced a draft and correctly routed it to human review. It does **not**
   claim the letter was sent. The eventual human edit + resume (4b/4c) will
   write its own entry with `provenance=human_edited`.

## Consequences

- Enables `interrupt`/resume for exception runs with the smallest possible
  change; resume is proven by test (`test_exception_interrupt.py`:
  `Command(resume=...)` drives a parked run to a clean end). **4b landed the
  `POST /api/appeal/resume` endpoint** (`run_resume`): it validates the run is
  parked, resumes via `Command(resume={"edited_text": …})`, and writes a
  distinct `human_edited` audit record (`idempotency_key=<corr>:resume`, same
  `correlation_id` — see the [ADR-0009 resume amendment](0009-idempotency-key-and-audit-writes.md#amendment--resume-writes-s3-slice-4b-2026-07-04)).
  The UX is 4c.
- **Serialization forward-compat (known, harmless today):** langgraph 1.2.7
  prints a deprecation notice when it deserializes our schema types
  (`RuleType`/`CaseTier`/`AppealRequest`/…) from the checkpoint on resume
  ("blocked in a future version"). It is a stderr notice, not a raised warning;
  resume works. The saver's per-instance serde allowlist does **not** silence
  it (the checkpoint load path does not honor it here), so the fix — an
  explicit msgpack type allowlist or registered serde — lands with the
  langgraph upgrade / the Phase 3 durable checkpointer, which owns
  serialization anyway. Documented at the `_PIPELINE` compile site.
- **Known limit (accepted pre-DB):** `InMemorySaver` shards under multiple
  uvicorn workers — a run parked on one worker cannot be resumed via another —
  exactly the audit-list limitation ([ADR-0009](0009-idempotency-key-and-audit-writes.md)).
  Acceptable now; **a PostgreSQL checkpointer replaces it at Phase 3**, landing
  with the durable audit store so persistence-before-`done` and
  resume-across-workers arrive together.
- **Transport-retry interaction:** re-invoking a completed `thread_id` with a
  fresh input dict (not a `Command`) starts a clean new run; the audit store
  still dedupes on `idempotency_key`, so `test_appeal_transport_retry_does_not_double_write`
  holds. Resuming a *parked* thread is a `Command(resume=...)` call — a distinct
  operation the 4b endpoint owns; guarding a fresh-input re-invoke of a parked
  thread is a 4b concern.
- No dependency change: `langgraph-checkpoint` is already floor-pinned
  (`>=3.0`, CVE-2025-67644, [ADR-0007](0007-deferred-dependencies.md)); this
  slice activates it, it does not add it.
- Reverses the "no checkpointer" line in the orchestration section of
  [02-backend-architecture.md](../02-backend-architecture.md) — updated in this
  PR, with isolation re-justified as keyed-not-shared.
