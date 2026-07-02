# 03 — Domain Model

*Verified against source 2026-07-02 (branch `project-review-hardening`).*

All backend data contracts are Pydantic models in
[backend/models/schemas.py](../../backend/models/schemas.py) (pipeline-facing)
and [backend/models/case_packet.py](../../backend/models/case_packet.py)
(enriched case record), plus the eval-side schema in
[backend/evals/fixtures/schema.py](../../backend/evals/fixtures/schema.py).
Per CLAUDE.md, types are never redefined inline — these files are the single
source of truth.

## Pipeline-facing entities

```mermaid
classDiagram
    class AppealRequest {
        scenario_id: str  max64 kebab-case
        drug: str
        diagnosis: str
        denial_text: str max5000
        denial_reason: str
        plan: str
        plan_id: str
        criteria_results: CriterionResult[]
        company_names: str[]
        security_hold: bool = False
        security_reason: str
    }
    class PipelineState {
        <<TypedDict>>
        request: AppealRequest
        pa_context: str
        pa_resolution: PaResolution
        appeal_text: str
        model_name: str
        passed_gatekeeper: bool
        retry_count: int
        errors: str[]
    }
    class CriterionResult {
        rule: Rule
        status: CriterionStatus
        note: str
        doc_source: str
        suggested_action: str?
        workflow_plan: WorkflowPlan?
        conflict_sources: ConflictSource[]?
    }
    class Rule {
        type: RuleType
        label: str
    }
    class WorkflowPlan {
        action: str
        recipient: str
        channel: str
        turnaround: str
    }
    class AuditRecord {
        scenario_id: str
        drug: str
        plan: str
        denial_reason: str
        timestamp: str
        duration_ms: int
        model_name: str
        prompt_tokens: int
        completion_tokens: int
        appeal_text_hash: str
        gatekeeper_passed: bool
        retry_count: int
        structural_eval_scores: dict
    }
    class ScenarioConfig {
        id, drug, manufacturer, plan, plan_id
        diagnosis, denial_reason
        client_type: ClientType
        criteria_results: CriterionResult[]
        citations: dict of str to Citation
        lifecycle: CaseLifecycle?
        pa_required / pa_outcome / appeal_handoff ...
    }

    PipelineState --> AppealRequest
    AppealRequest "1" --> "*" CriterionResult
    ScenarioConfig "1" --> "*" CriterionResult
    CriterionResult --> Rule
    CriterionResult --> WorkflowPlan
```

Notes:

- **`AppealRequest`** is strict-mode (`ConfigDict(strict=True)`) with
  max-length constraints — the validated HTTP boundary. `security_hold` /
  `security_reason` are set by the ETL, not expected from clients.
- **`PipelineState`** is the LangGraph-shaped TypedDict every node maps over.
  It is per-run and never shared (CLAUDE.md ACID §Isolation).
- **`ScenarioConfig`** is the rich scenario shape shared with the frontend
  demo — appeal scenarios plus optional initial-PA lifecycle fields
  (`pa_required`, `requested_therapy`, `pa_outcome`, `appeal_handoff`,
  `payer_response_analysis`) and multi-round appeal fields
  (`payer_counter_offer`, `round2_appeal`).
- **`AuditRecord`** is defined but not yet written anywhere — the pre-DB
  in-memory audit list and its provenance fields (AI-as-is vs
  gatekeeper-corrected vs human-edited) are Sprint 2 wiring; durable
  persistence is the PostgreSQL milestone
  ([10-roadmap-traceability.md](10-roadmap-traceability.md)).

## SSE events (discriminated union `AppealEvent`)

```mermaid
classDiagram
    class StepEvent {
        event = "step"
        step: str
        label: str
    }
    class ChunkEvent {
        event = "chunk"
        text: str
    }
    class DoneEvent {
        event = "done"
        model: str
        ref: str  sha256 prefix
        structural_scores: dict of str to float
        pa_resolution: PaResolution
    }
    class ErrorEvent {
        event = "error"
        message: str
        retry_count: int
    }
```

Exact wire format in [06-api-contract.md](06-api-contract.md).

## Enriched case record (CasePacket)

The golden-set output model — the unit of work for eval and appeal
generation. Not yet wired into the live pipeline.

```mermaid
classDiagram
    class CasePacket {
        case_id: str
        hub: HubClient
        patient: PatientContext
        coverage: CoverageInfo
        rx: RxDetail
        labs: LabResult[]
        pa_history: TimelineEvent[]
    }
    class HubClient {
        client_id, name, letterhead_name
        type: ClientType
    }
    class CoverageInfo {
        primary: Coverage
        secondary: Coverage?
        cob_type: str?
        financials: PlanFinancials?
    }
    class Coverage {
        payer, plan_id, member_id, group_id
        plan_type: commercial|medicare_advantage|medicaid|individual
        bin, pcn, effective_date
    }
    class PlanFinancials {
        deductible, deductible_met
        oop_max, oop_met, coinsurance_pct
    }
    class RxDetail {
        drug, ndc, dose, sig, quantity
        days_supply, refills, written_date, pharmacy
    }
    class LabResult {
        name, loinc?, value, unit
        ref_range, collected_date, abnormal_flag
    }
    class PatientContext {
        patient_name, patient_dob, patient_sex
        member_id, group_id, patient_address
        prescriber_name, prescriber_npi
        prescriber_specialty, prescriber_address, prescriber_phone
    }

    CasePacket --> HubClient
    CasePacket --> PatientContext
    CasePacket --> CoverageInfo
    CasePacket --> RxDetail
    CasePacket "1" --> "*" LabResult
    CoverageInfo --> Coverage
    CoverageInfo --> PlanFinancials
```

`PatientContext` is the one legitimate PHI sink (synthetic-by-construction in
the golden set, drawn from the closed `IDENTITY_POOL`); everything else must
pass through `redact_phi()` before leaving the process
([07-security-architecture.md](07-security-architecture.md)).

## Eval-side entities

`EvalScenario` ([evals/fixtures/schema.py](../../backend/evals/fixtures/schema.py))
is the canonical labeled record for one PA denial case — the shape of
[evals/fixtures/scenarios.json](../../backend/evals/fixtures/scenarios.json)
(currently 6 scenarios over 3 anchors: 3 `clinical_pa`, 1 `coding_error`,
2 `redteam`).

Key fields: `anchor_id`, `denial_type` (clinical_pa | coding_error |
administrative | redteam), `policy_refs`, `submitted_codes` vs
`policy_expected_codes`, `discrepancy_signals` (verbatim policy statements,
`human_action_required`), `criteria` (with `ground_truth_status` and
claim→span `GroundingRef`), `expected_outcome` (appealable, resolution path,
expected defensive behavior for redteam), `eval_dimensions`
(coverage | structure | safety | claim_citation | over_caution).

**The bridge:** [evals/fixtures_adapter.py](../../backend/evals/fixtures_adapter.py)
converts `EvalScenario` → `AppealRequest` / `ScenarioConfig` so the same
golden data drives retrieval packs, tests, and the demo UI — one dataset,
adapted per consumer, never duplicated (CLAUDE.md DRY).

## Enums

| Enum | Values | Home |
| --- | --- | --- |
| `CaseStatus` | processing, ready_for_review, exception, awaiting_documentation, submitted, payer_response | schemas.py ↔ types.ts (parity: hard-3) |
| `CaseLifecycle` | initial_pa, appeal | schemas.py ↔ types.ts |
| `RuleType` | diagnostic, temporal, math, safety, provider, quantity, custom | schemas.py ↔ types.ts |
| `CriterionStatus` | found, needs_review, conflict | schemas.py ↔ types.ts |
| `ClientType` | medtech, patient | schemas.py ↔ types.ts |
| `EvalDimension` | coverage, structure, safety, claim_citation, over_caution | evals/fixtures/schema.py (frontend rubric uses hyphenated twins) |
| `FileType` | pdf, image, text | etl/denial_letter/file_detector.py |
| Frontend-only | `View`, `Role`, `SimPhase`, `Urgency`, `CaseTier` (routine/complex/exception), `EvalMethodology` | src/types.ts |

`CaseTier` is frontend-only today; it becomes a backend concept when the
TierRouter lands ([ADR-0001](adr/0001-langgraph-target-orchestrator.md)).

## Frontend parity contract

`src/types.ts` mirrors `backend/models/schemas.py` field-for-field (camelCase
aliases on the Pydantic side). Drift is a build-breaker, enforced from both
directions:

- `src/data/scenarios_parity.test.ts` — anchor-join parity guard (Vitest, runs in CI)
- `backend/tests/unit/test_schema_parity.py` — enum-shape parity (added in hard-3)

Rule of thumb: **changing a shared shape is a two-file change plus a parity
test update, in the same commit.**

## Glossary

| Term | Meaning |
| --- | --- |
| **PA** | Prior authorization — payer approval required before a therapy is covered. |
| **Initial PA vs appeal** | Two lifecycle stages (`CaseLifecycle`): assembling/transmitting a new PA request (Da Vinci CRD → DTR → PAS rails) vs contesting a denial (appeal channel). Different artifacts, different transmission rails. |
| **Anchor** | One drug × payer × policy combination the golden set is built around (`ozempic_cigna`, `esomeprazole_uhc_pediatric`, `livdelzi_cigna_hepatology`). Scenarios derive from anchors. |
| **Golden set** | The canonical, provenance-tracked dataset under `backend/golden/` + `evals/fixtures/scenarios.json` — see [/docs/golden-set-governance.md](../golden-set-governance.md) and [ADR-0004](adr/0004-golden-set-canonical-dataset.md). |
| **plan_id** | Payer plan identifier (e.g. `CIGNA-CNF360-2024`) — the most specific PA-policy lookup key. Cigna market segments: `cnf_` (nonformulary), `ip_NNN` (employer PDL), `ip_NNN_ifp` (individual/ACA). |
| **Drug alias** | Alternate names for a drug (brand/generic) used as the retrieval fallback when `plan_id` doesn't match. |
| **pa_resolution** | Which retrieval path produced the PA context: `plan_id` (payer-specific), `drug_alias` (fallback), `generic` (boilerplate). A generic-fallback letter is a materially different artifact — this is audit-relevant (hard-5). |
| **BIN/PCN/Group** | Pharmacy-claim routing identifiers; the Sprint 5 hook for coverage-driven pack resolution via `golden/coverage_pool.json`. |
| **COB** | Coordination of benefits — primary plan governs PA; Medicaid is always payer of last resort. |
| **Security hold** | ETL-set flag on a request whose source document showed injection phrases, bidi characters, or hidden PDF text. Enforced at the pipeline gate (hard-1). |
| **Gatekeeper** | The deterministic post-generation check node — not an LLM ([ADR-0003](adr/0003-deterministic-gatekeeper.md)). |
