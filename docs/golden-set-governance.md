# Golden-Set Governance

**Version:** 0.1  
**Effective date:** 2026-06-30  
**Scope:** `backend/golden/`, `backend/evals/fixtures/`, `backend/golden_set/`  
**Enforced by:** `backend/tests/unit/test_golden_compliance.py` (CI `backend-unit` job)

---

## 1. Purpose & scope

The golden set is the canonical, auditable dataset for ClearAuth's AI evaluation
and regression infrastructure. It serves two roles:

1. **Eval + regression baseline** — every prior-authorization scenario, criterion,
   grounding reference, and expected outcome here is the ground truth against which
   appeal-generation quality is measured (RAGAS faithfulness, claim→citation
   alignment, LLM-as-judge scoring in Sprint 4+).

2. **Change-control gate** — the golden set is the anchor for the "sandbox →
   regression vs baseline → promotion" workflow for the Applied AI Lead.
   A breaking change to a scenario (different expected outcome, removed criterion,
   altered ICD-10 code) must be reviewed and approved before any model or pipeline
   promotion proceeds.

This document is the formal record of how data enters the corpus, what
classification it carries, and who is responsible for each artifact.

---

## 2. Data classification

| Class | Source | Contains PHI? | Example artifacts |
|---|---|---|---|
| **Public payer policy** (real) | Downloaded from publicly published payer PA criteria URLs | No | `golden/policies/*.md`, `_raw/*.txt`, `sources/*.pdf` |
| **Payer procedures** (real) | Downloaded from publicly published provider portals | No | `golden/payer_procedures/*.json` |
| **Regulatory rules** (cited public authority) | Verbatim or near-verbatim quotes from CMS/Medicaid.gov/federal statutes | No | `golden/regulatory/rules.json`, `provenance.json` |
| **Synthetic case data** (authored) | Hand-authored from a closed identity pool — no real patient data | No (by construction) | `evals/fixtures/scenarios.json`, `golden/identities.json`, `golden/coverage_pool.json` |
| **Generated synthetic documents** | Produced by `golden_set/generate.py` from seeds | No (by construction) | `denial_letter.txt`, `clinical_*.txt`, `rx_snippet.txt` (build artifacts) |
| **PROHIBITED** | Real denial letters, real patient records, real EHR data | Yes | Never committed to this repo |

All synthetic artifacts carry `SYNTHETIC — NO PHI` as a label (in the `_note`
field of JSON fixtures, in the file header of generated text documents). Enforcement
is automated: `test_golden_compliance.py::test_scenarios_fixture_carries_synthetic_marker`.

---

## 3. Public-policy sourcing procedure

### 3.1 Sourcing steps

1. Identify the payer's publicly published PA criteria or step-therapy document
   (provider portal, static CDN, or Surescripts/CRD API endpoint).
2. Confirm it is current and publicly accessible (no login required).
3. Download the raw PDF or HTML to `golden/policies/sources/<anchor_id>.pdf`.
4. Extract plain text to `golden/policies/_raw/<anchor_id>.txt`.
5. Author the structured Markdown summary at `golden/policies/<anchor_id>.md`
   (use `golden_set/policy_skeleton.py` to generate the skeleton, then fill in
   criteria from the raw text with inline citations).
6. Record provenance in `golden/policies/provenance.json` (see §3.2).

### 3.2 Provenance-manifest schema

Each record in `golden/policies/provenance.json`:

```json
{
  "anchor_id":        "ozempic_cigna",
  "source_url":       "https://...",
  "retrieved_date":   "YYYY-MM-DD",
  "effective_date":   "YYYY-MM-DD or null",
  "market":           "commercial | individual | medicaid",
  "raw_sha256":       "<sha256 of raw PDF/HTML bytes>",
  "markdown_sha256":  "<sha256 of authored .md file>",
  "terms":            "factual criteria extracted with citation; not redistributed verbatim",
  "format":           "pdf | html"
}
```

**Required for authored anchors** (those with a `.md` file):
`source_url`, `raw_sha256`, `markdown_sha256`, `terms`.

**Reference-only records** (no authored `.md`): use `source_pdf_sha256` instead of
`raw_sha256`; `markdown_sha256` is omitted.

Enforcement: `test_authored_anchors_have_complete_provenance` (compliance test).

### 3.3 Current corpus

| anchor_id | Policy | Market | Retrieved |
|---|---|---|---|
| `ozempic_cigna` | Cigna CNF-360 GLP-1 PA criteria | commercial (nonformulary) | 2026-06-25 |
| `esomeprazole_uhc_pediatric` | UHC PPI step therapy | commercial | 2026-06-25 |
| `livdelzi_cigna_hepatology` | Cigna CNF-877 Livdelzi PA criteria | commercial (nonformulary) | 2026-06-26 |
| `livdelzi_cigna_employer_pdl` | Cigna ip_0711 Livdelzi employer PDL | commercial (reference) | 2026-06-27 |
| `ozempic_cigna_ifp` | Cigna ip_0702 GLP-1 IFP criteria | individual/family | 2026-06-27 |
| `ozempic_cigna_employer_pdl` | Cigna ip_0701 GLP-1 employer PDL | commercial (reference) | 2026-06-27 |

---

## 4. Synthetic-generation procedure

### 4.1 Seed inputs

The three clinical anchors drive all synthetic generation:

| anchor_id | Drug | Payer / Plan |
|---|---|---|
| `ozempic_cigna` | Ozempic (semaglutide) | Cigna Connect 500 PPO |
| `esomeprazole_uhc_pediatric` | Nexium for Oral Suspension (esomeprazole) | UnitedHealthcare Choice Plus |
| `livdelzi_cigna_hepatology` | Livdelzi (seladelpar) | Cigna Connect 500 PPO |

Seed profiles (`golden_set/seeds.py`) specify per-criterion ground truth:
`found | needs_review | conflict`.

### 4.2 Closed identity pool

**File:** `golden/identities.json`

Three PatientIdentity records, one per anchor. Every PII-shaped value in every
synthetic corpus artifact must be a member of this pool. The pool is:

- **Closed**: no new name, DOB, member ID, NPI, address, or phone may appear in the
  corpus unless it is explicitly added to `identities.json` (and the associated
  anchor added to `coverage_pool.json` if it involves coverage data).
- **Deterministic**: hand-authored, not generated. Values are stable across runs.
- **Allowlistable**: `golden_set/identities.py` exports `POOL_NAMES`, `POOL_MEMBER_IDS`,
  `POOL_NPIS`, `POOL_DOBS` for use in the compliance scan.

### 4.3 Coverage pool

**File:** `golden/coverage_pool.json`

One CoverageRecord per anchor, with primary and (where applicable) secondary coverage.
Exports `POOL_COVERAGE_MEMBER_IDS`, `POOL_BINS`, `POOL_PCNS` for the compliance scan.

Coverage assignments follow real regulatory COB rules (§5). Primary is always a
sourced commercial plan; government-payer-as-primary scenarios require a new sourced
anchor and are not yet represented (see §4.4).

### 4.4 No-real-PHI guarantee

The guarantee is **synthetic-by-construction** + **closed pool** + **marker**:

1. Every patient identity value was invented by the author. No real person's data was
   used as input.
2. The closed pool is the complete allowlist: `test_golden_compliance.py` asserts
   that every `DOB MM/DD/YYYY` and `NPI XXXXXXXXXX` string in non-redteam scenario
   evidence summaries is a pool member.
3. Every generated text document carries the `SYNTHETIC — NO PHI` banner
   (enforced by `golden_set/markers.py::assert_marker()`).
4. Public policy docs are sourced from payer criteria pages; the compliance scan
   asserts they contain no pool member IDs or NPIs.

**Known limitation:** Pool patient names contain middle initials (e.g.
`Marcus T. Halverson`). The current two-word regex in `security/redact.py` does not
catch three-part names. Tracked in `docs/backend-security-debt.md` (item 7). The
prescriber names (no middle initial in the `First Last` portion) are caught and
verified by `test_redact_phi_catches_pool_prescriber_names`.

**COB guardrail:** Primary plan in every anchor is a sourced commercial policy.
Government payers (Medicaid, Medicare Advantage) appear only as COB secondary (see §5).
A government-payer-as-primary scenario is a future sourced anchor; it requires a new
government-plan PA policy document before synthetic cases can be generated.

### 4.5 Review and approval

Before adding or modifying any fixture:

1. Open a PR with the change isolated to the relevant file(s).
2. CI must pass (`test_golden_compliance.py` must be green).
3. For ICD-10 or criterion changes: note the clinical authority in the PR description.
4. For identity pool additions: verify the new name/DOB/ID are not real (use common
   sense: avoid names of public figures, avoid real ZIP codes for the fake address, etc.).
5. Approval from the Applied AI Lead (or designee) before merge.

---

## 5. Regulatory-rule registry

**Files:** `golden/regulatory/rules.json`, `golden/regulatory/provenance.json`

Rules underpin coverage labels in `coverage_pool.json`. Each rule follows the
**hypothesize → verify against authoritative source → cite** pattern:

```json
{
  "rule_id":                   "cob_primary_governs_pa",
  "statement":                 "...",
  "authority":                 "CMS Coordination of Benefits guidance; ...",
  "source_url":                "https://...",
  "corroborating_url":         "https://...",
  "retrieved_date":            "YYYY-MM-DD",
  "quote":                     "<verbatim or near-verbatim from source>",
  "effective_context":         "...",
  "confidence":                "high | medium | low",
  "last_verified":             "YYYY-MM-DD",
  "human_confirmation_required": false
}
```

**No rule may be added without a `source_url` and a verbatim or near-verbatim
`quote`.** Human confirmation is required while confidence is `< high`.

Current rules (verified 2026-06-29):

| rule_id | Authority |
|---|---|
| `cob_primary_governs_pa` | CMS Coordination of Benefits |
| `medicaid_payer_of_last_resort` | Social Security Act §1902(a)(25); CMS COB/TPL Handbook |
| `copay_card_government_program_exclusion` | 42 U.S.C. §1320a-7b(b) (Anti-Kickback Statute) |

---

## 6. Adversarial / red-team fixtures

Two scenarios in `evals/fixtures/scenarios.json` carry `denial_type: "redteam"`:

| scenario_id | Attack vector | Expected defense |
|---|---|---|
| `ozempic_cigna_injection_redteam` | Prompt injection in denial text | `security_hold` (sanitize_extracted_text detects) |
| `esomeprazole_phi_leakage_redteam` | Prompt asking system to repeat PHI | `phi_redacted` (redact_phi scrubs output) |

These scenarios:
- Are marked with `denial_type: "redteam"` (the corpus type marker).
- Carry an `expected_defensive_behavior` label on `expected_outcome`.
- Use synthetic/plausible adversarial input strings — NOT real patient data.
  The injection scenario uses pool-sourced identifiers; the PHI-leakage scenario
  uses generic synthetic names to simulate a realistic attack surface.
- Are excluded from the pool-membership check (adversarial strings may
  intentionally contain non-pool synthetic tokens).

Enforcement: `test_adversarial_fixtures.py` verifies the defensive behavior triggers;
`test_golden_compliance.py` verifies that real (public) policy docs are free of pool
identifiers even in the presence of adversarial text.

---

## 7. Controls

| Control | Mechanism | Scope |
|---|---|---|
| SYNTHETIC marker | `golden_set/markers.py::assert_marker()` on generated docs; `_note` prefix in JSON fixtures | Generated text docs + scenarios.json |
| Pool-membership scan | `test_golden_compliance.py::test_non_redteam_scenario_dobs_are_pool_sourced` + NPI variant | Non-redteam evidence_summary strings |
| Policy-doc PHI scan | `test_golden_compliance.py::test_policy_md_free_of_pool_member_ids` + NPI + raw + payer_procedures variants | All public docs in `golden/policies/` and `golden/payer_procedures/` |
| Provenance completeness | `test_golden_compliance.py::test_authored_anchors_have_complete_provenance` | 3 authored .md anchors |
| Dangling-ref scan | `test_golden_compliance.py::test_scenario_policy_refs_resolve` + `test_scenario_appeal_process_refs_resolve` | All scenario `policy_refs` and `appeal_process_ref` values |
| Regulatory-rule completeness | `test_regulatory_rules.py` | `golden/regulatory/rules.json` |
| No dangling rule_refs | `test_regulatory_rules.py::test_no_dangling_rule_refs_in_coverage_pool` | `golden/coverage_pool.json` |
| Adversarial-fixture labeling | `test_adversarial_fixtures.py` | Redteam scenarios |
| PHI redaction gate | `test_golden_compliance.py::test_redact_phi_catches_pool_prescriber_names` + DOB variant | `security/redact.py` × identity pool |
| CI enforcement | `.github/workflows/ci.yml` step "Golden-set PHI + fixture-integrity scan" | Every push / PR |

**Change-control** — any of the following requires a reviewed PR and CI green before merge:

- Adding or removing a scenario from `scenarios.json`
- Changing a scenario's `expected_outcome`, `criteria`, ICD-10 codes, or `denial_type`
- Adding or modifying an entry in `identities.json` or `coverage_pool.json`
- Adding or modifying an entry in `regulatory/rules.json`
- Modifying any policy `.md` file

---

## 8. Golden set as regression baseline

The golden set is **not** merely test data. It is the canonical baseline for:

1. **Structural regression** (Sprint 0/1): every scenario validates, all refs resolve,
   all markers present.
2. **ETL regression** (Sprint 1): the golden PDFs are the inputs; the scenarios define
   the expected extraction outputs (criterion presence, ICD-10, evidence text).
3. **LLM-quality regression** (Sprint 4+): RAGAS faithfulness, claim→citation
   alignment, and LLM-as-judge scores are compared against the ground truth
   (`criteria.ground_truth_status`, `grounding.doc_ref`, `eval_dimensions`).

The promotion gate is: **sandbox run score ≥ baseline on all golden scenarios → model
version promoted**. A regression on any scenario blocks promotion.

---

## 9. Roles, approvals, and audit trail

| Role | Responsibility |
|---|---|
| Applied AI Lead | Owns this document; approves changes to scenarios, criteria, and regulatory rules |
| Author (any engineer) | Submits PR with CI green; includes clinical/regulatory authority in description |
| CI | Enforces controls on every push/PR (no human bypass) |

**Audit trail:** Every artifact's origin is traceable:

- Public policy docs → `provenance.json` (source URL, SHA-256, retrieval date)
- Regulatory rules → `regulatory/rules.json` (source URL, verbatim quote, authority)
- Synthetic identities → `identities.json` (all values hand-authored; no upstream source)
- Scenarios → `evals/fixtures/scenarios.json` (references policy anchors and payer procedures by ID)
- Generated docs → `golden_set/seeds.py` + `documents.py` (fully deterministic; seed = anchor_id)

---

## 10. Future control: real-data on-ramp

When real denial letters arrive (runtime), PII de-identification must run **before**
any text is passed to an LLM, logged to Langfuse, or stored.

**Current backstop:** `security/redact.py::redact_phi()` — deterministic regex,
covers SSN / MRN / DOB / two-word names. Limitations: does not cover middle-initial
names, addresses, phone numbers, or NPI patterns. See `docs/backend-security-debt.md`.

**Planned control (DEFERRED — requires dependency-security gate):**

| Candidate | License | Notes |
|---|---|---|
| **OpenMed `privacy-filter-nemotron`** (recommended) | Apache-2.0 | Local-first / 100% on-device; covers all 18 HIPAA Safe Harbor identifiers; ~98.6% F1 on clinical text; NVIDIA-Nemotron based |
| **Microsoft Presidio** | MIT | Lighter; 50+ recognizers; ~0.74 clinical recall as sole gate — risky without a backstop |

**Why deferred:** Both bring a transformer + PyTorch weight chain. The same
dependency weight that excluded `easyocr` (CLAUDE.md) applies here. The
hand-rolled closed identity pool is the Sprint 0 approach; de-id is a
**runtime hardening control for Sprint 6+** when real denial letters are ingested.

Adoption path when ready:
1. Run full dependency-security gate per CLAUDE.md (CVE check, supply-chain search,
   pip-audit, network-behavior vetting for PHI context).
2. Prefer OpenMed (on-device, Apache-2.0, HIPAA-18) as the primary layer.
3. Keep `redact_phi()` as the defense-in-depth backstop — never replace it.
4. Gate on `ENABLE_PHI_DEID=true` env var; fail fast if the model is absent.
