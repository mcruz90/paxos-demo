# UI Unit Exploration Map — Gemini Design-Session Backlog

*Drawing-board phase, 2026-07-12. One row per atomic UI unit worth a
dedicated design exploration. Each unit lists the backend contract or
architecture doc that feeds it, its data status, and the stress-test
questions the mockup should answer. PHI posture per persona comes from
[12-phi-data-planes.md](../architecture/12-phi-data-planes.md) (ADR-0014).*

**Status legend:** `LIVE` = backend serves this today · `S4`/`S5`/`S6` = data
lands in that sprint · `VISION` = no backend story yet (mockups must be
labeled as roadmap; the mockup IS the spec).

## Session hygiene (apply to every Gemini session)

The three 2026-07-12 sessions produced three divergent design systems
(Inter/custom-CSS vs Outfit+Lora+Fira vs Tailwind-CDN) and an invented case
universe (Margaret Vance / Humira / BCBS). To make outputs adoptable:

1. **One shared token brief** — paste the same font/color/spacing tokens into
   every session (start from the demo's theme-aware emerald/purple tokens and
   `TierBadge`/chip idioms; keep light+dark).
2. **Golden-set cases only** — Ozempic/Cigna, Livdelzi/Cigna,
   Nexium-pediatric/UHC, and (since 2026-07-15) Humira/Cigna, which the
   golden-governance pass promoted from the mockups' invented universe into a
   researched anchor (`humira_cigna`, Cigna IP0652 — note: Cigna, not the
   mockups' invented BCBS). New clinical narratives still require the
   CLAUDE.md domain-research rule *before* they appear in a mockup. No
   invented payers, no invented lab thresholds.
3. **State the persona and plane at the top of each prompt** — the mockup's
   PHI rendering (full chart vs `PT-XXXX` masked) follows from it.
4. **Every unit mockup shows its empty, streaming/loading, error, and
   permission-denied states** — not just the happy path.

---

## Operate — PA coordinator / clinician (data plane)

| # | Unit | What it is | Feeds from | Status |
| --- | --- | --- | --- | --- |
| O1 | Document viewer with span highlighting | Source doc (denial letter, notes, labs) with glowing claim-anchored spans; scroll-to-highlight | `GroundingRef` claim→span labels (golden set, S0); rendered live post-S4 | S4 · demo-simulated shipped 2026-07-17 (`SourceDocViewer`, block-tagged fixtures — wire shape decision in ADR-0015) |
| O2 | Criteria card with source badge + confidence | Checklist row: status chip, confidence %, badge that jumps to O1's span | `CriterionResult.confidence` (LIVE); span link needs S4 | LIVE / S4 |
| O3 | Letter editor — Edit / Verify modes | Verify mode overlays per-claim citation status; conflict popover (draft value vs source value, "update draft") | S4 blocking claim→citation gatekeeper; `gatekeeper_corrected` provenance | S4 |
| O4 | Tier-differentiated review surfaces | routine = glance-approve card; complex ("Full Review") = full letter review; exception ("Escalation") = resolver | TierRouter (LIVE), ADR-0010; display labels in `ui.tsx` | LIVE |
| O5 | Exception resolver (core) | Parked case → reason + justification + edited text → resume | `/api/appeal/resume`, `edited_text`, dual audit records (LIVE) | LIVE |
| O6 | Exception resolver (evidence discovery) | Auto-discover pharmacy trials, PubMed/guideline search, doc Q&A chat | Gemini spec `/api/discovery/*` — no backend | VISION · demo rail shipped 2026-07-17 (`EvidenceDiscoveryConsole`/`FixtureChat`: fixture-honest, free-form Q&A defers) |
| O7 | Pending-review queue / worklist | Parked runs, tier badges, open-to-resume | ADR-0011 audit-as-queue-index (LIVE) | LIVE |
| O8 | Case timeline | CRD → assemble → submit → determination → appeal rounds as a dated rail | 05-state-lifecycle; audit `timestamp`/`duration_ms` give real points (LIVE, partial) | LIVE/S5 |
| O9 | Patient roster + patient file IA | Filterable roster → demographics banner → tabbed file (profile / PA hub / claims / vault) | **Needs tenancy model — does not exist** (ADR-0014 prerequisite) | VISION · demo IA shipped 2026-07-17 (`PatientProfile`/`PriorAuthHub`, `patientRef` grouping — G1 tenancy still the backend gap) |
| O10 | Transmission / dispatch surface | Rail-accurate send: PAS rail for initial PA, appeal channel for appeals; deterministic `submission_ref`; artifact hash | PAS stub rail + `artifact_ref` (LIVE); package compiler/e-fax | LIVE / VISION |
| O11 | Doc-gap workflow ("awaiting documentation") | Pre-submission gap ≠ denial: request-records flow, attestation checklist | `CaseStatus 'awaiting_documentation'`, docgap fixture; `workflowPlan` has no backend | VISION · demo dispatch + awaiting-docs semantics shipped 2026-07-17 (activity log snapshots the outbound artifact) |
| O12 | Multi-round appeal (payer response / counter-offer) | Round 2 flow, counter-offer compare | Demo Round2 panels exist; `counter_offer` signal has **no producer** | VISION · demo dispute-packet flow shipped 2026-07-17 (G3/P10 decision still open) |
| O13 | Break-glass PHI access | Justification modal → time-boxed reveal → audit entry | New from ADR-0014 — nothing exists | VISION |
| O14 | Session chrome | Auto-login via `GET /api/auth/me` (today a refresh loses a valid session), expiry warning, re-auth without losing work | ADR-0013; `me()` client exists unused | LIVE (gap) |

**Stress tests for Operate sessions:** What does the reviewer see when the
gatekeeper *blocks* an uncited claim (O3) — and how do they fix it without
free-typing new uncited text? What does an SSE drop mid-letter look like
(terminal-error contract)? What renders when the same case is deliberately
resubmitted (attempt bump — does the UI explain idempotency)? Where does the
statutory decision clock live on screen (see gap G2)?

## Build — Applied AI lead (control plane; PHI-free by construction)

| # | Unit | What it is | Feeds from | Status |
| --- | --- | --- | --- | --- |
| B1 | Failure Review on redacted artifacts | Cluster → redacted excerpt → **link to the golden case that reproduces it** → break-glass as last resort | Golden set (ADR-0004); redaction rules; the PHI-safe debugging story of ADR-0014 | S4 |
| B2 | Eval dashboard on real aggregates | Success rate, retry rate, `pa_resolution` distribution, structural-score trends from audit records | `GET /api/audit/records` (LIVE); `run_evals.py` report | LIVE / S4 |
| B3 | Provider A/B comparison | Same golden set, two backends, per-dimension deltas — feeds the open provider decision | S4 CLI is provider-parametric (`LLMBackend` seam, ADR-0002) | S4 |
| B4 | Claim→citation gatekeeper inspector | Per-letter: claim list, citation status, what was corrected; makes demo "check #4" real | S4 blocking gatekeeper | S4 |
| B5 | Prompt/instruction versioning + eval-gated promotion | Edit → run eval gate → promote/rollback; versioned change control | Artifact-versioning pattern (set on Agent Instructions); needs `GET/POST /api/prompts` | VISION (near) |
| B6 | Ontology / pack editor with provenance | Pack rules each carry source citation + confidence + verified-by; synthesize-on-miss lands here for human gating | Policy-pack resolution + regulatory-grounding pattern (`discrepancy_signals` is the template) | S5 |
| B7 | Golden-set curation flow | Add case → research prompt → citation + confidence capture → adversarial variant | CLAUDE.md domain-research rule as a UI; golden governance doc | VISION (near) |
| B8 | Audit-trail explorer | Search by `correlation_id`; one ID traces request → events → record → letter hash end-to-end | ADR-0009 (LIVE) | LIVE |
| B9 | Node-graph observability | Per-node status/latency/tokens on the real graph; NodeRunPanel's "example run" becomes a real run | Demo NodeRunPanel exists; per-node metrics not emitted (Langfuse deferred, ADR-0007) | VISION |
| B10 | Redteam / adversarial suite results | Standing regression: adversarial fixtures vs current pipeline, drift alarms | S0 adversarial fixtures; S4 wires them | S4 |

**Stress tests for Build sessions:** Can every screen be rendered with *zero*
patient-identifying data and still be useful (the plane's core claim)? What
does B5's promotion flow do when the eval gate *fails*? For B1: does the
golden-repro link actually shorten the debug path, or does everything funnel
to break-glass (if so the design failed)?

## Scale — implementation lead (control plane)

| # | Unit | What it is | Feeds from | Status |
| --- | --- | --- | --- | --- |
| SC1 | Onboarding-as-config wizard | New tenant: EHR connector, payer set, pack selection, thresholds — config not code | Platformization thesis; demo OnboardingView exists | S5 |
| SC2 | Connector registry + health | Per-connector (Epic/Athena/ModMed rails) status, last sync, error budget | Adapter pattern (CLAUDE.md); no live connectors | VISION |
| SC3 | Coverage / pack registry browser | BIN/PCN/Group → market/tier → pack resolution, inspectable | Sprint-1 resolver + `pa_requirements.json` (LIVE data, no route); S5 Qdrant | S5 |
| SC4 | Automation-policy / tier-band configuration | **Design question, not just a screen:** tier bands are code constants today — should they be per-tenant config? Who approves a band change, and is it eval-gated like prompts? | TierRouter bands (ADR-0010 lineage); demo AutomationPolicyView | VISION (decision needed) |
| SC5 | Tenant PHI-posture attestation | Per-tenant data-flow map, BAA status, plane boundaries — sales/compliance artifact | ADR-0014 / doc 12 | VISION |

**Stress tests for Scale sessions:** SC4 is the deep one — a tenant wanting
"more automation" is asking to move a safety boundary; design the friction.
For SC1: what does day-2 look like (edit a live tenant's config), not just
day-0 onboarding?

## Sponsor — manufacturer analyst (analytics plane)

| # | Unit | What it is | Feeds from | Status |
| --- | --- | --- | --- | --- |
| SP1 | Coverage insights with suppression | Approval/denial rates by payer/plan/region; **suppressed cells render as "<11" not as 0** | Demo SponsorView; small-cell rule from doc 12 | VISION |
| SP2 | Time-to-therapy funnel | Prescription → PA → determination → on-therapy durations | `PaOutcome.timeToTherapy` field exists (LIVE, fixture-fed) | S6 |
| SP3 | Formulary / policy landscape tracker | Payer-policy changes over time for the sponsor's drug | Market dimension research; registry | VISION |
| SP4 | PSP / affordability handoff analytics | Where affordability gaps were detected and routed (represent-not-operate — counts, never adjudication detail) | Affordability handoff design (S6) | S6 |

**Stress test for Sponsor sessions:** try to design any drill-down that would
reach patient level — the UI should make it *structurally impossible*
(no such route), not merely denied.

## Cross-cutting units

| # | Unit | Notes |
| --- | --- | --- |
| X1 | PHI-scoping demo moment | Same case viewed across personas: full chart in Operate → `PT-904128` + redactions in Build. The persona switcher becomes the security story. Gemini's redaction treatment is directly reusable. **Shipped in demo 2026-07-17** (`SourceDocViewer` Operate/Build toggle + `RedactionLedger`; render-time stand-in for the ADR-0014 tokenizer). |
| X2 | Provenance chips | `as_is` / `gatekeeper_corrected` / `human_edited` rendered consistently everywhere an artifact appears (live AuditTrailPanel has the first idiom). |
| X3 | Correlation-ID thread | Any artifact anywhere → click → full trace (B8 as a global affordance). |
| X4 | Design-token consolidation | One token sheet (type scale, chips, tiers, planes) all sessions share — see session hygiene. |
| X5 | Live/demo seam strategy | **Decided 2026-07-17** ([ADR-0016](../architecture/adr/0016-single-shell-capability-manifest.md)): single-shell destination, incremental migration behind the [capability manifest](../architecture/13-capability-manifest.md). Slice 1 (O5/O7/B8 in the portfolio shell) started same day; `LiveApp` demoted to a dev console. |

## Gaps noticed — missing from project docs, warrant investigation

| # | Gap | Why it matters |
| --- | --- | --- |
| G1 | **Tenancy / user→patient assignment model** | Nowhere in the backend. Prerequisite for O9, minimum-necessary scoping, and ADR-0014's data plane. Needs a design session of its own. |
| G2 | **Statutory decision clocks / SLA tracking** | State PA laws and CMS-0057-F impose payer response windows; the demo shows "Due soon" strings, the backend has nothing. A real differentiator for Operate (worklist ordered by regulatory deadline). Research the exact windows before fixing numbers in UI. |
| G3 | **Counter-offer / multi-round producer** | TierRouter honors a `counter_offer` signal nothing produces; demo has Round-2 UI. Either design the backend story or mark the demo panels roadmap. |
| G4 | **Notification / assignment model** | The queue is pull-only. Who is told when a case parks or a determination lands? Assignment, not just visibility. |
| G5 | **Break-glass flow** | New ADR-0014 commitment; needs both UI (O13) and an `AuditRecord` reason class. |
| G6 | **Auto-login gap** | `GET /api/auth/me` exists and is never called — a refresh drops a valid session (O14). Small, fix in the next live-mode slice. |
| G7 | **Doc-gap `workflowPlan` backend** | Frontend concept from the docgap recast has no backend counterpart (O11). |
