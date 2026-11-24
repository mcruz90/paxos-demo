# ADR 0022 — Persist discovery snapshots and attachment receipts

Status | Proposed for T-20 review
--- | ---
Scope | Synthetic pediatric discovery and attachment in the PostgreSQL case store

## Decision

A search persists the query string, case revision and ordered result snapshots in one transaction. Each result has its own identifier. Composite foreign keys bind every result, attachment and receipt to one tenant, patient and case. An attachment references its original result for immutable provenance. The authenticated panel grant supplies the actor. PostgreSQL supplies the timestamp.

The pediatric adapter searches the explicitly bound fixture. Full-text items carry the source digest and a half-open span measured in Unicode code points. The initial increment offers the complete note as one selectable span. The outside-records index exposes its title only. Its digest identifies the UTF-8 title bytes. Its null span and excerpt express that the document body was unavailable.

Writes hold the case row lock through commit and check the supplied clinical revision. A result can be attached only at its discovery revision. Discovery and attachment leave clinical revision and assessment inputs unchanged. This lets a reviewer collect several documents for the same assessment before requesting reassessment in a later slice.

Attach and remove persist an actor-scoped command receipt with the operation, target, expected revision and attachment identity. After grant resolution, an identical retry returns the original response, including after removal. Any other use of that request ID conflicts. Removal hides the attachment from the active list and preserves its provenance for replay. The case row lock serializes concurrent first submissions of the same command.

A search may supply a request ID scoped to the actor and case, in a separate namespace from attachment commands. Under the same write lock, a retry with identical query text and expected revision reads the original snapshot before checking the current revision. A changed binding returns 409 with code `idempotency_conflict`. A new search against an obsolete revision returns 409 with code `stale_case_revision`. Both preserve `detail: case_conflict`.

The case history endpoint returns up to 50 summaries, newest first with query UUID as the tie-breaker. Migration 0006 timestamps new queries. Earlier rows have an unknown creation time and appear last in UUID order with a null timestamp.

## Consequences

Reloading the case requires only the database for previous queries and attachments. Re-running a query without a request ID creates a fresh result set. Separate request IDs express separate commands. Storage grows with searches and attachment history. Future adapters must provide correctly scoped immutable sources and distinguish visible metadata from accessible document text.
