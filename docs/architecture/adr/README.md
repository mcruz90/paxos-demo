# Architecture Decision Records

One file per decision. An ADR records a decision that shapes system structure,
its context, and its consequences — so the decision survives the conversation
it was made in, and so it isn't silently re-litigated later.

Most of these ADRs are **backfilled** (written 2026-07-02, after the fact) to
capture decisions already made across Sprint 0, Sprint 1, and the hardening
pass. New decisions get new ADRs at decision time.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-langgraph-target-orchestrator.md) | LangGraph is the target orchestrator; hand-rolled pipeline is interim | Accepted |
| [0002](0002-provider-neutral-llm-backend.md) | Provider-neutral LLM backend behind a Protocol; no default provider | Accepted |
| [0003](0003-deterministic-gatekeeper.md) | Deterministic gatekeeper — the generator never grades itself | Accepted |
| [0004](0004-golden-set-canonical-dataset.md) | The golden set is the canonical test/eval dataset | Accepted |
| [0005](0005-dual-branch-strategy.md) | Dual-branch strategy: `demo` (mock UI) vs `main` (real build) | Accepted |
| [0006](0006-sse-streaming-transport.md) | SSE transport with a guaranteed terminal event | Accepted |
| [0007](0007-deferred-dependencies.md) | Dependencies stay out of the tree until something imports them | Accepted |
| [0008](0008-event-driven-pubsub-declined.md) | Event-driven pub/sub architecture | Rejected |
| [0009](0009-idempotency-key-and-audit-writes.md) | Idempotency-key shape and the pre-DB audit write path | Accepted |
| [0010](0010-in-memory-checkpointer-exception-interrupt.md) | In-memory checkpointer for the exception-tier interrupt | Accepted |
| [0011](0011-audit-trail-as-review-queue-index.md) | The audit trail is the parked-run review-queue index | Accepted |
| [0012](0012-generated-wire-types-from-openapi.md) | Generated TypeScript wire types from OpenAPI; Pydantic is the authored source | Accepted |
| [0013](0013-fastapi-bff-session-cookie-auth.md) | FastAPI as its own BFF: session-cookie auth beside Bearer | Accepted |

## Statuses

- **Proposed** — under discussion, not yet binding.
- **Accepted** — binding. Code should conform; deviations need a superseding ADR.
- **Rejected** — considered and declined. Recorded so it isn't re-proposed
  without new information.
- **Superseded by ADR-NNNN** — no longer binding.

## Template

```markdown
# ADR-NNNN: <Title>

- **Status:** Proposed | Accepted | Rejected | Superseded by ADR-NNNN
- **Date:** YYYY-MM-DD
- **Decided by:** <who>

## Context

What situation forced a decision. Constraints, alternatives on the table.

## Decision

The decision, stated as a fact ("We will…"). Include the trigger/condition
if the decision is staged.

## Consequences

What becomes easier, what becomes harder, what future work this commits us to.
```
