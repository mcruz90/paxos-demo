# Case and evidence runtime contracts — infrastructure increment

Status: contracts/pure attachment preparation are recorded locally. A separate
case repository increment has real-database and full regression validation;
Claude re-review remains a separate gate. No new live API, reassessment or
frontend capability is claimed.
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

## Case persistence boundary (separate increment)

CaseAccess is a trusted server-resolved grant for one tenant/patient/actor. It is
required at every repository read/write; there is no platform wildcard or default
scope. It is not an HTTP model or an authorization factory. Future routes must
derive it from authenticated tenant and panel authorization; constructing a model
does not prove those grants. CaseCreateRequest accepts only idempotency_key;
client-supplied case_id is forbidden. No new route is exposed by this increment.

CaseRepository stages a case and a metadata-only case_created event in one
transaction. Request identity is tenant + actor + operation + idempotency key.
Identical retries replay the original creation revision even if the current case
later changes. Key reuse for another patient conflicts. After the advisory lock
and replay check, new requests receive a random UUIDv4; distinct keys create
distinct cases. PostgreSQL case_id columns are uuid, with tenant_id + case_id
primary/foreign keys. UUIDv7 and caller-chosen case ids are not used. Read ids
are validated as bounded canonical UUIDv4 strings before SQL. Unique/FK
constraints protect case/event identity.

Creation requires TransactionStatus.INTRANS before any SQL/savepoint. IDLE,
INERROR, ACTIVE and UNKNOWN are rejected as outer_transaction_required. The
caller owns the outer transaction and must commit before reporting success.
A repository return is not a durability acknowledgement: connection context exit
can still fail. Audit-write failure rolls back case creation. Read and event
queries both filter tenant AND patient AND case. Rehydration uses model_validate;
invalid rows and driver failures produce metadata-only typed errors. Event rows
are append-only through this repository; this is not a database-admin tamper-proof
log. Existing pipeline audit/review stores remain unchanged and in memory.
Invalid boundary input uses case_input_invalid, separately from driver failures
and invalid stored records. There is only one creation event per case today;
before adding revision-2 event types, add a database sequence and order by it
instead of transaction-time plus random UUID. No total-order guarantee is claimed.

Migration 0002 adds only case-creation events. Evidence/source repositories,
optimistic evidence updates, findings, artifacts, approval/export and persistent
pipeline audit remain future increments. No clinical facts or gold labels enter
these infrastructure tests. Backend-canonical pediatric esomeprazole was selected
by May on November 18 for subsequent clinical fixture work.
