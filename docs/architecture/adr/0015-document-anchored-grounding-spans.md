# ADR-0015: Document-anchored grounding spans

- **Status:** Accepted (2026-07-17)
- **Date:** 2026-07-17
- **Decided by:** May (direction agreed and accepted in the 2026-07-17 architecture review)

## Context

Two grounding models now exist for "which piece of the source record backs
this claim":

1. **Backend (golden set, S0):** `GroundingRef` labels a criterion with
   `{doc_ref, section}` — document-level, no span.
2. **Frontend (2026-07-17 UI exploration):** `SourceDocBlock.criterionLabel`
   tags an authored block of a rendered document, with the block's text
   required to be verbatim-equal to the citation snippet (parity-tested).

Neither shape can serve what Sprint 4 needs. The claim→citation scorer and
the **blocking** gatekeeper (CLAUDE.md §AI Output Accountability) must
deterministically answer "does this exact claim text appear in the cited
source?" — document-level refs are too coarse, and block tags are a
presentation artifact whose granularity is fixed at authoring time and
cannot express sub-block (phrase-level) citations. The P6 citation
workspace (units O1–O3) needs the same answer to light a span on screen.

## Decision

`GroundingRef` becomes **span-bearing against a canonically stored document
body**, and it is the single source of truth for grounding:

- Each grounded criterion/claim carries `{doc_ref, start, end}` character
  offsets into the canonical text of that document. `section` remains as a
  human-readable locator.
- **Canonical text rule:** the stored document body is exactly the text the
  offsets index. Any normalization (whitespace, OCR cleanup) happens
  *before* labeling, never after — a structural test slices every span and
  asserts it equals the citation text (`doc.body[start:end] == citation.text`).
- Document bodies are served through a new API surface (spec-first Pydantic
  model → generated wire types per ADR-0012).
- The frontend's block model becomes a **derived view**: blocks are computed
  from the body + spans at render time (or build time for fixtures), never
  authored as an independent source of truth. The current hand-authored
  `SourceDocBlock` fixtures and their text-equality parity test are the
  interim stand-in and migrate when the endpoint lands.

## Consequences

Easier:
- The S4 scorer, the blocking gatekeeper, and the O1 span highlight consume
  one datum; verbatim-quote verification is a deterministic substring check
  (ADR-0003-compatible — never a second LLM call).
- The existing frontend text-equality parity test stops being hand-maintained
  and becomes structural.

Harder / committed work:
- Serving document bodies before P6 can land (new endpoint + wire types).
- Fixture authoring gains offsets; tooling (a span-check test, optionally a
  labeling helper) must keep them honest.
- **PHI plane:** document bodies are data-plane objects (doc 12, row
  "Clinical facts"). The serving endpoint is Operate-only, must be
  tenancy-scoped when the G1 tenancy model lands, and pre-tenancy sits
  behind the existing auth like the rest of the API (accepted interim
  posture).

Rejected alternative: promoting the block-tagged shape to the wire contract —
it locks granularity at authoring time, cannot express phrase-level spans,
and gives the scorer nothing to compare against. Contracts derived from
presentation artifacts are how parity drift started; declined.

## Sequencing

Amend alongside P6 (citation workspace) and the S4 gatekeeper work; P6's
preconditions gain "ADR-0015 accepted". Until then the demo's block fixtures
remain labeled as the interim stand-in (ui-unit-exploration O1 row).
