# ADR-0009: Idempotency-key shape and the pre-DB audit write path

- **Status:** Accepted
- **Date:** 2026-07-03 (Sprint 2 Slice 4)
- **Decided by:** May (delegated: sprint plan named the key shape; this ADR
  records the exact derivation and its consequences)

## Context

CLAUDE.md's Observability/Durability rules (TARGET-tagged until this slice)
require: every run traceable end-to-end from a single `correlation_id`; any
endpoint or node that writes an `AuditRecord` (or, later, submits to a real
payer) must be idempotent — a retried request (client timeout, network blip,
SSE reconnect) must never double-submit or double-write; and the key must
derive from case identity + submission attempt, never wall-clock time.

Two IDs were in play (correlation vs idempotency) and the sprint plan pinned
the key to `case_id` + attempt. What needed deciding: the exact string
shapes, where the IDs are minted, how a *deliberate* resubmission differs
from a *transport* retry, and what happens when the audit write itself fails.

## Decision

1. **Case identity:** `case_id = case_ref or scenario_id`
   (`audit/ids.derive_case_id`). `InitialPaRequest` carries `case_ref`;
   `AppealRequest` has no case_ref field, so its scenario_id is the case
   identity.
2. **Idempotency key:** `"{case_id}:a{attempt}"` — `attempt` is a request
   field (`>= 1`, default 1). A **transport retry reuses the same attempt**
   (same key → audit write dedupes); a **deliberate resubmission bumps
   attempt** (new key → new audit entry). The client owns that distinction —
   only the caller knows whether it is retrying or refiling.
3. **Correlation ID coincides with the idempotency key pre-DB.** One string
   names the logical run across server logs, the terminal SSE event
   (`correlation_id` on `done`/`error`), and the `AuditRecord`. When durable
   storage lands, a per-execution ID can hang off this logical key if
   needed; today two IDs with one value would be pure ceremony.
4. **Write point:** both pipeline boundaries (`audit/boundary.with_audit`)
   stamp the terminal event and write the record **before** yielding it
   (ACID §Durability). Every run writes exactly one record — done,
   gatekeeper-exhausted, node-exception, and security-hold terminals, both
   lifecycles. `provenance` is `as_is` at this boundary until the
   gatekeeper-correction (S4) and human-edit (HITL) paths exist.
5. **Audit-write failure never breaks the stream contract.** The terminal
   event still reaches the client; the failure is logged loudly. With the
   in-memory store this is effectively unreachable; the PostgreSQL milestone
   revisits whether a failed durable write should convert the terminal to an
   `error` (strict persist-before-done).

## Consequences

- Replaying the same request is safe by construction — tests pin that two
  identical runs produce one audit entry (`test_audit_write_path.py`).
- `attempt` rides the request schema (both lifecycles), so the future PAS
  double-submit guard can reuse the same key without a schema change — the
  stub rail's deterministic `submission_ref` already lines up with it.
- The in-memory store shards under multiple uvicorn workers — accepted
  pre-DB (CLAUDE.md), documented in `audit/store.py`; do not build on it
  beyond this sprint.
- Terminal SSE events gained additive fields (`correlation_id`; DoneEvent
  `retry_count`) — documented in [06-api-contract.md](../06-api-contract.md);
  no existing field changed shape.

## Amendment — resume writes (S3 Slice 4b, 2026-07-04)

Point 3 above ("correlation_id coincides with the idempotency key pre-DB")
gets its first deliberate exception. Resuming a parked exception-tier run
([ADR-0010](0010-in-memory-checkpointer-exception-interrupt.md)) is the SAME
logical run as the machine draft — it must trace under the **same
correlation_id** — but a DISTINCT auditable event (a human reviewed/cleared
the letter). So the resume record keeps `correlation_id = <case_id>:a<attempt>`
and takes `idempotency_key = <correlation_id>:resume`
(`derive_resume_idempotency_key`). The two IDs now differ, exactly as this ADR
foresaw ("a per-execution ID can hang off the logical key"): the divergence
buys a distinct `human_edited` record that is not deduped against the draft's
`as_is` record — the accountability trail keeps both. Resume idempotency is
enforced first by the parked-state check (a completed run cannot be resumed
again) and backstopped by the key.
