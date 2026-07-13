# Citation Workspace — Tech Spec (units O1–O3 + X1)

*Companion to [mockup.html](mockup.html) (self-contained, no CDN — open in
any browser). Covers the units this mock explores from
[ui-unit-exploration.md](../../ui-unit-exploration.md), the data contracts a
real implementation binds to, and the React port plan. This is the S4
frontend's design spec; nothing here requires backend work beyond what
Sprint 4 already plans (P1/P2 in
[opus-session-prompts.md](../../opus-session-prompts.md)).*

## What the mock demonstrates

| Unit | In the mock | Try it |
| --- | --- | --- |
| O1 document viewer + span highlighting | Left pane, 4 source docs (denial letter, consult, med list, visit notes) with anchor spans | Click any source badge or claim → tab switch + smooth-scroll + glow |
| O2 criteria card + source badge + confidence | Criteria tab: the real cnf_360 checklist with the golden-label confidences (98/99/92/74) | The 74% needs-review card explains *why* the case routed to Full Review |
| O3 letter Edit/Verify modes | Verify underlines every claim: emerald=cited, amber=value conflict, red=uncited; gatekeeper bar blocks Transmit until resolved | Click the BMI claim (conflict → "update to 33.2") and the HbA1c claim (uncited → remove or request records) |
| X1 PHI-scoping toggle | Operate/Build segmented control: Build masks identifiers (`PT-904128`, `XX/XX/1972`, `[REDACTED BY EHR GATE]`), letter shows `{{PATIENT_NAME}}` tokens, editing disabled, plane banner explains ADR-0014 | Toggle personas with the letter open — same case, two planes |
| Hygiene rule 4 (states) | State selector: default / streaming (skeletons) / error (terminal-error banner with the ADR-0006 contract language) | Top bar |

**Fixture continuity:** all clinical content is verbatim from the golden-set
`novo-ozempic` scenario (criteria, citations, denial reason, cnf_360
narrative). The only invented data is demo PHI (patient name/MRN/member ID),
which is identity, not a clinical claim. The letter's BMI conflict (32.8 vs
33.2) and uncited HbA1c sentence are constructed *errors* for the
verification flow — they demonstrate the gatekeeper, they are not fixture
facts.

## The design thesis (what to evaluate this mock against)

1. **Every claim is one click from its evidence.** Trust is demonstrated
   in-place, not asserted by a score.
2. **Fixing a claim never invites free-typed prose.** The uncited-claim
   popover offers exactly: link-to-evidence (when spans match), apply the
   source value (conflicts), remove the claim, or route to the doc-gap
   workflow (O11). New text can only enter via Edit mode, where it is
   re-verified. This answers the Operate stress test in the exploration map.
3. **The gatekeeper is a gate, not a dashboard.** Transmit is disabled while
   any uncited/conflicting claim stands — the UI renders CLAUDE.md's
   no-uncited-claim rule literally.
4. **The plane is a rendering mode, not a permission error.** Build persona
   sees the same workspace with identifiers tokenized and editing off — the
   PHI posture is structural (X1 / ADR-0014), demonstrable by a toggle.

## Data contracts (what the real implementation binds to)

The mock's `CLAIMS` registry is the shape the S4 blocking gatekeeper
(prompt P2) should surface per claim. Proposed wire additions — final shape
is P2's spec-first decision, listed here as the UI's requirements:

```ts
// Per-claim verification result (S4 gatekeeper output; travels on the done
// event or a follow-up GET — P2 decides which).
interface ClaimVerification {
  claim_id: string
  // Character range of the claim in the letter text — the letter itself
  // stays a plain string on the wire; spans index into it.
  start: number
  end: number
  status: 'cited' | 'conflict' | 'uncited'
  grounding: GroundingSpan | null          // null iff uncited
  conflict: { entity: string; draft_value: string; source_value: string } | null
}

// Already exists in the golden set as GroundingRef (S0) — rendered by O1.
interface GroundingSpan {
  doc_id: string        // which source document
  page: string
  start: number         // span offsets within the document text
  end: number
  source_label: string  // "Specialist Consult · p. 1"
}
```

UI-side derivations (pure, unit-testable, no backend):
- `verifySummary(claims) → { cited, conflict, uncited, blocked }` — drives
  the chips and the Transmit disable (the mock's `renderVerify`).
- `applyConflictFix(letter, claim) → letter'` — deterministic source-value
  substitution.
- Span-offset → DOM mapping for both panes (the only genuinely fiddly part;
  see port notes).

What already exists and needs **no** backend change: criteria + confidences
(`criteria_results`, live today), source citations (fixture `citations`
map), tier (DoneEvent), resume with edited text (`/api/appeal/resume`),
dual-provenance audit records. What waits for S4/P2: `ClaimVerification[]`
itself and the block-on-uncited enforcement. What waits for ADR-0014
acceptance: the tokenized Build rendering being *true* rather than
presentational.

## Interaction inventory

| Interaction | Behavior | Non-happy path |
| --- | --- | --- |
| Source badge / cited claim click | Switch doc tab, smooth-scroll, 1px sky glow on span | Span missing from doc (contract violation) — do not defend in UI; the parity test catches it |
| Conflict claim click | Popover: draft vs source value, "Update draft to X" applies substitution, claim → cited, summary re-renders | — |
| Uncited claim click | Popover: remove / request-records; **no inline edit** | Zero matching evidence: link option absent (mock's c5) |
| Remove / restore | Strikethrough + excluded from gatekeeper counts; restore returns it to uncited | Removed claims stay visible — the reviewer sees what was cut |
| Edit ↔ Verify toggle | Edit = contenteditable, underlines off; Verify = read-only + verification | Re-entering Verify re-runs verification (real impl re-calls the pure summary over fresh ClaimVerification) |
| Persona toggle (X1) | Operate: full PHI, editable. Build: tokens/redactions, read-only, plane banner, popovers off | Break-glass is *not* a toggle — deliberate omission (O13 is its own unit) |
| State selector | streaming = skeletons + dimmed content; error = terminal-error banner (ADR-0006 language) | — |
| Transmit (all clear) | Notes the real call: `/api/appeal/resume`, dual audit records, same correlation_id | Disabled with explanation while blocked |

## React port notes (when P6's preconditions are met)

- **Components** (one file each, ~existing idioms): `SourceDocViewer`
  (O1; owns tab + highlight state), `CriterionCard` (O2; extends the live
  `CaseContextPanel` row with the source badge), `VerifyLetter` (O3; renders
  letter string + `ClaimVerification[]` as spans), `ClaimPopover`,
  `GatekeeperBar`, `PersonaPlaneToggle` (X1 — demo-only affordance; real
  users have one persona). Reuse `TierBadge`, chip classes, and the token
  sheet from `ui.tsx`.
- **Span rendering:** never `dangerouslySetInnerHTML` over letter text —
  split the letter string by `ClaimVerification` offsets into text/claim
  segments (pure function, RED-first test with overlapping/adjacent spans).
  Same splitter serves both panes.
- **State:** claim statuses + removals are one `useReducer` over
  `ClaimVerification[]`; everything else derives. No context needed.
- **PHI rendering (X1):** identifiers arrive either rehydrated or tokenized
  per plane — the component renders what it is given and never holds both
  forms (doc 12 rule). The mock's dual-`<span>` trick is mock-only.
- The mock is ~750 lines of single-file HTML; expect the port at roughly
  6 components + 3 pure modules + tests, all under the 300-line cap.

## Open questions for the next design/implementation session

1. Where does `ClaimVerification[]` travel — enriched done event vs.
   `GET /api/appeal/{correlation_id}/verification`? (P2 decides; GET keeps
   the SSE contract untouched and matches the audit-derived-state idiom.)
2. Conflict auto-fix vs. re-generation: applying a source value edits the
   letter *after* the LLM — the edited letter must re-enter the gatekeeper
   (it does, via resume → P2's resume-path fix) — confirm the loop renders
   as one action to the reviewer, not two.
3. Does the doc-gap route from the uncited popover create the O11 workflow
   object now, or just set `awaiting_documentation`? (G7 backend gap.)
4. Small-screen behavior: the split collapses to which pane first?
