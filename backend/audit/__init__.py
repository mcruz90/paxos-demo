"""audit — pre-DB audit trail: ID derivations and the in-memory record store.

Every pipeline run (either lifecycle, done or error) writes exactly one
AuditRecord before its terminal SSE event is emitted. See ADR-0009 for the
idempotency-key / correlation-id shape.
"""
