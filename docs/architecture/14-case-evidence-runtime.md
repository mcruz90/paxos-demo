# Case and evidence runtime contracts — infrastructure increment

Status: contracts and pure attachment preparation only. No new live API, database,
criteria reassessment or frontend capability is claimed by this increment.
PostgreSQL in a dedicated Docker service/volume is the agreed storage direction.

The server's authenticated tenant and persistent patient/case identity scope every
record. Request bodies cannot choose tenant or actor, supply gold/scoring fields,
override criteria, or claim readiness. Expected case revision is required for
attachment writes; a stale revision must fail, not overwrite newer work.

Canonical source versions store immutable text and its SHA256 over UTF-8 bytes.
Evidence attaches one exact source version and nonempty half-open span [start,end).
Offsets count Unicode code points, not UTF-8 bytes or JavaScript UTF-16 code units.
The UI must convert browser selection positions against the exact canonical body
(for example using Array.from(text) for code-point indexing), never normalized or
rendered text. Source digest and excerpt text must match before an attachment is
prepared. Wrong tenant/case/patient references and stale versions are rejected.

Source categories are patient_record, payer_policy, guideline and research. Staff
interpretation is a separate future object, never a source fact. Patient records
must match the case's patient. Public/context source snapshots have no patient
association. Case-local source snapshots preserve an origin reference; discovery
corpus registration and access checks precede snapshot creation in a later slice.

Preparation returns an immutable attachment record with its own identity, source
and excerpt digests, actor, role and optional criterion reference. It does not
persist, change case revision, satisfy a criterion, reassess or approve anything.
The future repository transaction must atomically store the attachment, increment
case revision and append its audit event, with an idempotency key. Schema validation
and pure scope/span checking cannot replace authenticated route authorization.

Both request and stored attachment types reject empty/reversed spans on validation,
and require excerpt length to match the code-point span, including row rehydration.
Source types also validate category/patient-reference consistency. Domain failures carry EvidenceRejected.code for future
HTTP mapping; routes must not parse exception messages. Pydantic rejects invalid
Unicode text at the schema boundary. Context evidence may reference a criterion
to explain relevance, but that reference never asserts satisfaction or patient facts.
The future repository must additionally verify criterion existence and case scope,
use database constraints, and verify stored canonical content/digests. Models alone
are not authentication or a substitute for transactional integrity.

Gemini owns UI implementation. Pydantic models are re-exported via models.schemas;
once routes are added, OpenAPI-generated wire types remain the frontend contract
(ADR-0012). Existing demo types and fixtures are not promoted to live by this change.
