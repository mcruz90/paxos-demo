# ADR-0014: PHI visibility planes and the tokenization boundary

- **Status:** Accepted (2026-07-17, as amended)
- **Date:** 2026-07-12 (amended 2026-07-17 — see §Amendment)
- **Decided by:** May (design direction set in the 2026-07-12 drawing-board session; amendment direction chosen and ADR accepted 2026-07-17)

## Context

The platform serves four personas with fundamentally different relationships
to patient data: the clinician/PA coordinator (Operate) works individual
cases; the Applied AI lead (Build) authors rules, prompts, and evals; the
implementation lead (Scale) configures connectors and tenants; the
manufacturer analyst (Sponsor) consumes market analytics.

The current security posture ([07-security-architecture.md](../07-security-architecture.md))
draws one boundary: PHI may live **inside** the process (requests, pipeline
state, LLM prompts) but must never leave via **side channels** (logs, traces,
error messages, fixtures — `redact_phi()` at the logging boundary).

Two pressures forced a sharper decision:

1. **Persona-scoped UI design.** UI exploration (Gemini mockup sessions,
   2026-07-12) surfaced a "zero-trust" posture — *the server never stores or
   processes direct identifiers; the clinician's browser injects PHI
   client-side*. That absolutist version breaks letter generation (an appeal
   letter must ultimately carry the patient's identity) and would force
   client-side or EHR-gateway assembly — a much larger architectural claim
   than the product needs.
2. **The apparent conflict** that clinicians *need* PHI in their workflow
   while ClearAuth staff and the LLM never should. Framed as one
   access-control wall, these look contradictory. They aren't: HIPAA's
   operative rule is **minimum necessary per role and purpose**, not one
   permission bit.

## Decision

We adopt **three visibility planes** plus a **tokenization boundary**, in
place of a single PHI wall:

1. **Data plane (Operate).** Clinicians/PA coordinators see full, rehydrated
   PHI for **their own patients** (treatment/operations basis; tenancy-scoped
   — see prerequisite below). This is the only plane where direct identifiers
   render.
2. **Control plane (Build, Scale).** These personas operate on objects that
   are **PHI-free by construction** — rules, packs, prompts, eval dimensions,
   failure clusters, connector config, aggregate metrics, golden-set
   fixtures. This is stronger than access control: the object model contains
   nothing to leak. Failure debugging follows a three-layer path:
   de-identified reproduction on the golden set first; redacted artifacts and
   identifiers-and-hashes audit records by default; **break-glass** access to
   a live case as the audited exception (named user, recorded justification,
   time-boxed, written to the audit trail).
3. **Analytics plane (Sponsor).** Aggregates only, with small-cell
   suppression (no cell below n=11, CMS-style). Patient-level data never
   reaches a manufacturer under any workflow, including support tickets.

**Tokenization boundary.** Direct identifiers (name, DOB, MRN, member ID,
address, phone — the Safe Harbor identifier classes) are replaced with typed
tokens (`{{PATIENT_NAME}}`, `{{DOB}}`, …) **at ETL ingest**. The pipeline's
working object — retrieval, synthesis, gatekeeper, evals, audit — is the
tokenized case. The LLM never receives direct identifiers; clinical facts
(diagnosis, labs, med history) remain, as the letter requires them.
**Rehydration is deterministic and happens only at egress**: the Operate
rendering path and final letter assembly/transmission. The token→identity
map is stored separately from the case (it is itself PHI — encrypted,
data-plane-scoped).

**Honesty scope.** Free-text clinical narrative can still be re-identifying;
this is a designed control with acknowledged residual risk, not Safe Harbor
de-identification. Marketing/demo language must say "the LLM never receives
direct identifiers," not "the AI never sees PHI."

**Staging.** This ADR sets the *target* posture. Pre-DB, the enforced
controls remain those of doc 07 (redaction at side channels; XML-delimited
untrusted text). Tokenize-at-ingest lands when the ETL upload route is wired
(S5 platformization owns it — the ETL is currently unreachable from any
route). Until then, the demo may present the posture as a labeled design
target, per the same honesty rule applied to the claim→citation gatekeeper
(no capability shown as live before it exists).

## Consequences

Easier:
- Build/Scale UI can be designed and built now with **no PHI dependency at
  all** — their data model never had it.
- The persona switcher becomes a demonstrable security story: the same case
  renders as a full chart in Operate and as `PT-904128` + redacted blocks in
  Build.
- Sponsor analytics are compliance-safe by construction.
- "Which persona may see this field?" stops being a per-view debate; it is
  answered by [12-phi-data-planes.md](../12-phi-data-planes.md).

Harder / committed work:
- ETL grows an identifier tokenizer + a separately-stored, encrypted token
  map; letter assembly grows a rehydration step; tests must prove no raw
  identifier reaches an LLM prompt or leaves on the control plane.
- **Tenancy model is a prerequisite** for the data plane (user→patient
  assignment does not exist anywhere in the backend today) — new roadmap
  item.
- Break-glass needs flow + audit support (a new `AuditRecord` reason class).
- On acceptance: doc 07 gains the plane/boundary model, and
  10-roadmap-traceability gains rows for tokenizer, tenancy, and break-glass.

## Amendment (2026-07-17): hybrid scrub — deterministic gate, NER backstop

Direction chosen by May in the 2026-07-17 architecture review, prompted by
the requirement that **no direct identifier ever reaches an LLM prompt** and
the proposal to use a self-hosted healthcare NER model (OpenMed-class) for
free-text de-identification.

**Terminology precision.** The enforceable invariant is stated over *direct
identifiers* (Safe Harbor classes), not "all PHI": clinical facts tied to a
token identity must reach synthesis or no letter can be drafted — this is
the same honesty scope as the original decision. Marketing/audit language
follows the original rule ("the LLM never receives direct identifiers").

**Placement constraint (settled).** All scrubbing runs **inside the ETL
ingest boundary, as the first operation on ingested text** — never upstream
of the cloud boundary (edge/connector scrub was re-examined and stays
rejected: if identifiers never reach the server, the token→identity map
cannot exist server-side, and egress rehydration/letter assembly breaks —
the same reason the original ADR rejected client-side injection). "Before
tokenization" is a stage ordering within ingest, not a different trust
boundary.

**The three layers:**

1. **Deterministic typed tokenization** (unchanged from the original
   decision) of all known identity values — `{{PATIENT_NAME}}`, `{{DOB}}`,
   `{{MRN}}`, `{{MEMBER_ID}}`, … — remains the *reversible* layer (the only
   one rehydration undoes) and the redaction ledger's exact source of truth.
2. **NER backstop (detector, never authority):** a self-hosted
   healthcare-NER model scans the already-tokenized text for *residual*
   identifier-like spans in free narrative. Hits are irreversibly masked
   (they are not in the token map; nothing rehydrates them) or quarantined
   for human review at low confidence. Runs as a **sidecar service** in its
   own container/venv so the model dependency chain (PyTorch/transformers —
   the same chain that got `easyocr` removed) never enters the main backend
   tree. Model + weights go through the full CLAUDE.md dependency-security
   protocol (pinned revisions, safetensors only) before adoption.
3. **Deterministic leak gate at the `LLMBackend` seam** — the single
   enforcement point (CLAUDE.md: detection pairs with enforcement). Every
   outbound prompt is scanned for known identifier values and unresolved
   NER-flagged spans; a hit **blocks** the call and raises (mirrors the
   `security_hold` pattern). Because the gate sits at the Protocol seam
   (ADR-0002), every current and future provider inherits it.

**Why hybrid, not NER-primary:** a model redactor is probabilistic — it can
*raise recall* on free text but cannot *be* the MUST-guarantee (false
negatives), and its false positives can destroy clinically load-bearing
facts (dates are Safe Harbor identifiers *and* the substance of temporal
criteria). Nondeterminism would also break the byte-identical rehydration
test. The deterministic layers stay the guarantee; the model only adds
recall; model failure degrades to the original deterministic baseline,
never below it.

**Sequencing.** The tokenizer work (P9) splits: **P9a** = deterministic
tokenizer + LLM-boundary leak gate (gated on this ADR's acceptance, as
before). **P9b** = NER sidecar, additionally gated on (i) the
dependency/model vetting protocol and (ii) a **de-identification eval** —
golden-set documents seeded with planted identifiers, recall/precision
measured *before* the model is trusted (evals-before-trust, the S4
discipline). The demo UI's render-time redaction (`redaction.ts`,
`RedactionLedger`) remains a labeled stand-in for layer 1.
