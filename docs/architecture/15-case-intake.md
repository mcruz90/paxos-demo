# Case intake and shared tokenization

The backend entry point is `etl.case_intake.CaseIntake.ingest`. It accepts
plain UTF-8 bytes and a trusted source-version ID on a case-local snapshot.
The caller supplies the known identity from the authorized case context.
Each successful call returns the prepared document and the next immutable
snapshot. A hold raises a reason code and returns neither.

## Source and token coordinates

The intake limit is 400,000 bytes and 100,000 Unicode code points before and
after sanitization. Line endings become LF. The sanitized text is the
canonical body and its SHA-256 covers its UTF-8 bytes. Excerpts use
zero-based, half-open Unicode code-point offsets into this body. Tokenized
text has its own offsets and must never supply canonical excerpt positions.

Shared tokens reuse an exact value within a token kind. Spelling or formatting
variants may receive separate tokens so that restoration preserves the source
text. Intake reserves literal token strings across snapshots. A document
containing a previously issued token holds without changing the prior table.
Trusted egress must call `restore`. It holds on unmapped tokens, malformed
tokens, and literal double-brace delimiters even when they were meant as
ordinary text. Token maps and canonical document bodies contain identifiers
and belong on the trusted data plane.

## Routing and holds

Sanitization and the deterministic residual-identifier check run before a
result is exposed. The classifier reads the canonical body. Only a first
denial enters the denial field extractor, which reads tokenized text.
Field extraction is heuristic and carries evidence quality per field.
The deterministic residual check looks for identifiers already known to the
case or detected during tokenization. Unrecognized identifiers in free text
remain a risk.

The existing denial-letter ETL also uses the shared sanitizer. Its text
sanitizer preserves ordinary characters such as the registered trademark
sign and checks folded text for instructions. Its PDF hidden-text check
continues to run separately.

This increment prepares text documents in process. Authenticated intake,
immutable source persistence, encrypted token-map storage, PDF/OCR ingestion
for case documents, trusted egress wiring and the provider-boundary gate are
follow-up work under [ADR 0014](adr/0014-phi-visibility-planes-tokenization.md).
Current appeal and initial-PA routes continue using their existing inputs.

## Provenance

The deterministic product code comes from `ports/clearauth` in the
clearauth-eval revision `8b18c4478f6976389f6dc7fea7335545a9e7d74d`.
The port uses the live document classifier, denial field extractor, sanitizer
and deterministic tokenization chain. The prescriber registry supports offline
entries only. The deterministic combiner checks the tokenized output once
and holds on residual identifiers. The proposed output screening and repair
from decision 0046 remain outside this path. The implementation has no
runtime harness dependency. Product tests use synthetic records and identities.
