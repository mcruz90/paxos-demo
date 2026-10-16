# External-Review Triage — Dispositions + Statute Verification

*Authoritative decision record. May-approved 2026-07-19. Statute verification
by Fable 2026-07-19 against primary sources.*

Two external LLM reviews were run against the project:

- **Gemini** produced four design-exploration sessions (harvested verbatim to
  [`docs/design/explorations/`](explorations/); provenance in that folder's
  README).
- **Microsoft Copilot** produced eleven PRDs (harvested verbatim to
  [`docs/design/external/prd-copilot/`](external/prd-copilot/); provenance and
  the non-canonical-ID warning in that folder's README).

This document is the single place where each artifact's **disposition** —
adopt / record / discard, with corrections and blockers — is recorded. The
harvested artifacts stay verbatim; **all corrections live here**, not in the
artifacts.

> **Non-canonical IDs (cross-cutting).** Every unit ID (`O14`/`O15`/`O16`/`O17`/
> `S12`/`W1`) and ADR number (`0018`–`0021`) appearing inside the external
> artifacts is invented by the generating model and collides with the real
> registries. The canonical registries are
> [`ui-unit-exploration.md`](ui-unit-exploration.md) and
> [`docs/architecture/adr/README.md`](../architecture/adr/README.md).

---

## 1. Statute verification results

Verified by Fable, 2026-07-19, against primary sources. These corrections apply
wherever the harvested artifacts characterize the underlying law.

### CMS-0057-F — CONFIRMED (with one correction)

The CMS Interoperability and Prior Authorization final rule is confirmed as
characterized:

- Expedited decisions within **72 hours**; standard decisions within **7
  calendar days**.
- Effective **2026-01-01**.
- **Specific denial reasons are mandatory.**
- **Public reporting** of PA metrics begins **2026-03-31**.

**CORRECTION to Gemini's `decision-clocks/research.md` table:** the
decision-timeframe provision **EXCLUDES QHP issuers on the FFEs** (Qualified
Health Plan issuers on the Federally-Facilitated Exchanges). Those issuers are
in scope only for the **API requirements** (2027), *not* the decision
timeframes.

*Sources: cms.gov — CMS-0057-F fact sheet; cms.gov — Prior Authorization API FAQ.*

### NY Insurance Law §4903 — REFUTED as characterized

Gemini's research characterized a missed NY deadline as a **deemed approval**.
This is **wrong**:

- A missed deadline is **"deemed to be an adverse determination subject to
  appeal"** — i.e. a **denial**, not a deemed approval.
- **Exception:** for a **step-therapy protocol override request**, a missed
  deadline constitutes an **automatic override**.

**Design consequence.** Gemini's *"Generate Notice of Deemed Approval"* CTA is
**invalid as designed**. The valid, narrowed version is an **automatic
step-therapy-override path**. This is highly relevant here because our
golden-set anchors are step-therapy denials — the narrowed version is the one
worth building.

*Source: nysenate.gov/legislation/laws/ISC/4903.*

### TX / CA / ERISA rows + all clock-pause claims — UNVERIFIED

The TX and CA rows, the ERISA row, and **all clock-pause claims** in
`decision-clocks/research.md` are **UNVERIFIED**. They must be verified against
primary sources **before** any of them enters a fixture or config (the
`statutory_clocks` work, gap G2).

---

## 2. Gemini disposition

### 2.1 `decision-clocks/research.md` — ADOPT (as G2 seed)

**ADOPT** as the seed for the **G2 statutory-clocks registry**, with the two
statute corrections in §1 applied *at adoption time*. The artifact stays
verbatim; the corrections live in this document.

### 2.2 `decision-clocks/` mockup + tech-spec — RECORD (G2 design input)

**RECORD** as G2 design input.

- **Adopted insights:** worklist **ordered by governing-law clock**; the
  **ERISA vs state-regulated plan split** — the worklist must know *which law
  governs each plan*.
- **Redesign needed:** the deemed-approval CTA, per the NY §4903 correction
  in §1 (narrow it to a step-therapy-override path).

### 2.3 `letter-workspace/` — ADOPT (SU slice 2 + S4 verify UI)

**ADOPT** as the design input for **SU slice 2** and the **S4
verify-mode / gatekeeper UI** (unit O3).

- The `ClaimVerification` / `GroundingSpan` **character-offset schema is
  congruent with ADR-0015 `GroundingRef`.**
- **Caveat:** invented patient identities and clinical values (BMI / MELD /
  CDAI figures, the Cyltezo narrative) require **golden-set vetting per the
  CLAUDE.md domain-research rule** before entering `src/data/scenarios.tsx`.

### 2.4 `break-glass/` — ADOPT (O13 / G5 design input)

**ADOPT** as the **O13 / G5** design input — friction gates, timed reveal,
relock, and the ledger-record shape.

- **Correction:** its cited basis "ADR-0013/0017" is **wrong**. The actual
  commitment is **ADR-0014** (break-glass, gap **G5**).
- Same invented-identity caveat as §2.3.

### 2.5 `demo-critique/` — dispositions per May's inline adjudications

Dispositions **follow May's inline adjudications recorded in the artifact
itself**. New gaps arising from the critique are registered in the exploration
map (see [`ui-unit-exploration.md`](ui-unit-exploration.md)). Two corrections
to the critique:

1. The claim that `AuditRecord` stores **no cryptographic output hash** is
   **FALSE** — `artifact_ref` **is a content hash by design** (ADR-0009).
2. The proposal for **deterministic checks between every LangGraph node** is
   **PARKED** — it is an architectural question that requires its own ADR
   discussion; it is **not accepted by default**.

---

## 3. Copilot PRD dispositions

Each PRD is dispositioned explicitly below. Recall the cross-cutting warning:
all unit IDs and ADR numbers inside these PRDs are non-canonical.

### slice1 — statutory-clocks — HIGH (reference PRD for G2)

**HIGH value.** Reference PRD for **G2**, alongside Gemini's registry (§2.1).

- Its **IL / MD override-hour values are self-described approximations —
  UNVERIFIED.** Where this PRD disagrees with Gemini's sourced registry, **the
  registry wins** pending verification.
- Minor: uses the wrong ADR path (`backend/docs/adr/`).

### slice2 — G4 assignment / notifications — MEDIUM

**MEDIUM.**

- **Adopted insight:** `publish_nowait` **must precede `interrupt()`**
  (LangGraph `interrupt()` raises internally) — an expert-level catch.
- **BLOCKER before any build:** the in-process `NotificationBus` **must be
  explicitly argued against ADR-0008** (event-driven pub/sub, *Rejected*) in a
  **new ADR**.
- Its **role model (`reviewer | supervisor | service`) conflicts with
  slice9's** — both **PARKED**; ADR-0017 deliberately defers roles.

### slice3 — appeals-escalation / P2P — RECORD (new domain)

### slice6 — external-review / board-appeals — RECORD (new domain)

**RECORD** (both) as **genuinely new domain territory** — a new exploration
row (appeals-escalation domain).

- The two PRDs use **competing vocabularies (`AppealLevel` vs `AppealMode`)**
  for the same domain — **reconciliation required before any build.**
- Their statutory citations (IL 20 ILCS 2210/155.04d, MD HB 1563, CA AB 1183)
  are **UNVERIFIED and possibly apocryphal.**
- This **does NOT reopen the P10 Option B decision** (the counter-offer
  producer stays deliberately unbuilt — see
  [`p10-counter-offer-brief.md`](p10-counter-offer-brief.md)).

### slice4 — CRD / DTR — MEDIUM-HIGH

**MEDIUM-HIGH.** Aligns with the roadmap's Da Vinci direction.

- Its **`O14` unit ID collides with the real O14 (session chrome).**
- Adding a **checkpointer to the PA graph is a real design change needing an
  ADR** when scheduled.
- See also the `documentation_supplied` provenance criticism in slice7 below.
- **AMENDMENT (2026-10-16, ADR-0018) to §5.3 CRD resolution precedence:** a
  registry miss (the plan_id is not a pack — a drug-alias match counts as a
  miss since ADR-0019) no longer gives
  `pa_required = false` ("fail-open; flag in audit for manual review"). It
  gives **unknown** (`pa_required.required = null`): nothing is submitted and
  a person decides. Step 2's "No" branch now reads `pa_required = null`
  (unknown — needs review by a person, never "not required"). Only a payer
  CRD answer (step 1) may say "not required".

### slice5 — benefit-type expansion — RECORD

**RECORD.** Fleshes out the existing roadmap row (`PaTargetType`). Its
`drug_present`-gatekeeper workaround is flagged as **tech debt it itself
acknowledges.**

### slice7 — outbound dispatch — MEDIUM-HIGH

**MEDIUM-HIGH.** Good adapter / deterministic-ref design, consistent with the
PAS rail.

- **CORRECTION:** `provenance=dispatched` **misuses `AuditProvenance`**.
  Provenance records **content-verification status** (`as_is` /
  `gatekeeper_corrected` / `human_edited` / `human_approved`); **dispatch is a
  lifecycle action and belongs in a separate field.** The **same criticism
  applies to slice4's `documentation_supplied`.**

### slice8 — evidence discovery — HIGH (reference PRD for O6 backend)

**HIGH.** The **closest of all 11 to our conventions**:

- keyword / BM25 first with **zero new deps**;
- Qdrant behind the **ADR-0007 gate**;
- **sanitize-before-engine**;
- **XML-delimited slots**;
- deterministic `evidence_id`.

Reference PRD for the **O6 backend** when scheduled.

### slice9 — tenancy Phase 3 — RECORD

**RECORD.** Largely matches **ADR-0017's Phase 3 vision** and P7a's
acceptance-suite plan.

- **Too large as one slice** (audit store + sessions + checkpointer + roster +
  roles) — **must be split.**
- Its **role enum conflicts with slice2's** — parked.

### slice10 — tier-band policy — RECORD (best answer to SC4)

**RECORD** as the **best concrete answer to SC4's design question** — a
promotion-signal aggregator, with a hard-coded statutory-floor guard kept
distinct from configurable validation.

- **BUG flagged:** it keys reviewer approval on `provenance=human_edited`,
  which — under the **2026-07-18 provenance-honesty amendment (ADR-0009)** —
  **systematically misses `human_approved`**, the strongest approval signal.
- Also **calls the policy editor "unit B8"** — the real **B8 is the
  audit-trail explorer.**

### slice11 — coordinator workbench — DISCARD as spec (retain as vision)

**DISCARD as a spec.** It contradicts our decisions:

- proposes **JWT + refresh** (vs **ADR-0013**);
- assumes **LangGraph Cloud / Platform** (we are in-process);
- proposes **Redis** plus a **four-package frontend dependency spree** (vs
  **ADR-0007**);
- puts **full patient names in list views** (vs **ADR-0014**).

**RETAIN as vision inventory only:** the three-pane cockpit layout, the
checkpoint task-card pattern, and the composite queue-priority formula.

---

## 4. Secondary source

**linear.health PA process flow chart**
(https://linear.health/blog/prior-authorization-process-flow-chart): a
secondary / vendor source that **corroborates CMS-0057-F**. It contributes two
new items:

1. a **retroactive-authorization flow** (absent from our
   `05-state-lifecycle`); and
2. the **denial-triage branch** (correctable → resubmit vs
   medical-necessity → appeal → P2P → external).

It is also a **competitor signal** — Linear Health sells PA automation.

---

## 5. Confirmation — what both reviews validated

Both external reviews, working independently, treated our core invariants as
**load-bearing** and found **no structural flaw**:

- audit-write-before-terminal;
- fail-closed `TenancyScope`;
- deterministic gatekeeper / tier-router;
- parity + wire-freshness gates;
- XML prompt isolation.

Their **gap lists converged onto the existing exploration map** — external
validation both of the architecture and of the map's completeness. The genuinely
new gaps they surfaced are registered in
[`ui-unit-exploration.md`](ui-unit-exploration.md) (manual case intake, external
Auditor persona, security-hold quarantine surface, appeals-escalation domain,
retroactive-authorization lifecycle).
