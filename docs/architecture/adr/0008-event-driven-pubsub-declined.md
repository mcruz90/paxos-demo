# ADR-0008: Event-driven pub/sub architecture — declined

- **Status:** Rejected
- **Date:** 2026-07-02 (backfilled; declined during the CLAUDE.md
  architecture-expansion discussion, 2026-07-01)
- **Decided by:** May

## Context

While codifying architecture patterns into CLAUDE.md (adapter, strategy,
idempotency, correlation IDs), an event-driven pub/sub backbone (internal
event bus, publish domain events, subscribers for audit/notifications/
downstream workflows) was considered as a further pattern to adopt
pre-emptively.

## Decision

**Not adopted.** At current scale — a single FastAPI process, one linear
pipeline, JSON-on-disk data — a pub/sub layer is over-engineering: it adds
delivery semantics, ordering, and debugging indirection while every present
need is met by direct calls plus the SSE event stream (which is already the
externally visible "event log" of a run).

The audit trail specifically does **not** need a bus: the ACID §Durability
rule (AuditRecord appended before the SSE `done` event is emitted) is a
synchronous, in-process guarantee — stronger and simpler than an async
subscriber could give.

## Consequences

- No event-bus abstraction may be introduced casually; reversing this
  requires a superseding ADR with a concrete driver (e.g. multiple consumer
  services, payer-webhook fan-out, or a queue-backed worker pool at real
  volume).
- Cross-cutting concerns keep their current shapes: audit = synchronous
  append at the pipeline boundary; observability = Langfuse tracing when it
  lands; workflow fan-out = explicit `WorkflowPlan` values routed by code,
  not events.
- Recorded so the idea isn't re-proposed from scratch each time the
  architecture is reviewed — new information (real scale, real integration
  fan-out) is what reopens it.
