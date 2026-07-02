# 05 — State Machines & Lifecycles

*Verified against source 2026-07-02 (branch `project-review-hardening`).*

Four state machines matter, at different altitudes: the **case** (business
state, shared enum), the **case lifecycle** (initial PA vs appeal), the
**pipeline run** (one SSE request), and the **frontend POC simulation**
(`SimPhase`).

## CaseStatus — business state of a case

Enum: `backend/models/schemas.py` ↔ `src/types.ts` (parity-tested, hard-3).

```mermaid
stateDiagram-v2
    [*] --> processing : case created / pipeline running
    processing --> ready_for_review : pipeline done, letter drafted
    processing --> exception : flag needs human decision
    processing --> awaiting_documentation : pre-submission doc gap
    awaiting_documentation --> processing : docs received
    exception --> ready_for_review : human resolved flag
    ready_for_review --> submitted : reviewer approves & transmits
    submitted --> payer_response : payer determination received
    payer_response --> [*] : accepted / closed
    payer_response --> processing : dispute → next round
```

Semantics worth pinning:

- **`awaiting_documentation` ≠ denial.** It is a *pre-submission* gap (the
  PH-3101 flow — e.g. missing chart note before the PA can even be filed),
  not a payer response. Modeling it as an exception hid the distinction.
- **`exception`** means the AI surfaced something a human must decide
  (conflicting sources, needs-review criterion) — the tiered-HITL routing
  target for the TierRouter ([ADR-0001](adr/0001-langgraph-target-orchestrator.md)).
- Queue prioritization (frontend `Urgency`: today / soon / later) is derived
  from regulatory turnaround deadlines, orthogonal to `CaseStatus`.

## CaseLifecycle — which artifact is being produced

```mermaid
stateDiagram-v2
    state initial_pa {
        [*] --> crd_check : PA required? (paRequired)
        crd_check --> assemble : yes — build structured PA request
        assemble --> pas_submit : transmit (PAS rail)
        pas_submit --> determination : paOutcome
        determination --> [*] : approved — patient on therapy
        determination --> pended : payer pends
        pended --> determination
    }
    initial_pa --> appeal : paOutcome denied — appealHandoff launches appeal scenario
    state appeal {
        [*] --> generate : 4-node pipeline drafts appeal
        generate --> review : human review
        review --> submit : appeal channel (NOT the PAS rail)
        submit --> response : payerResponseAnalysis
        response --> round2 : partial approval / dispute (round2Appeal)
        round2 --> review
        response --> [*]
    }
```

The two stages use **different transmission rails** — PAS for initial PA,
appeal channels for appeals — so artifacts must be rail-accurate. A denied
initial PA hands off to the appeal flow via `appealHandoff` (same patient,
continuing case reference). Absence of `lifecycle` on a scenario means
`appeal` (the original demo scenarios).

## Pipeline run — one `POST /api/appeal/generate`

Source: [backend/agents/graph.py](../../backend/agents/graph.py). Terminal
states are exactly `done` and `error` — guaranteed
([ADR-0006](adr/0006-sse-streaming-transport.md)).

```mermaid
stateDiagram-v2
    [*] --> backend_construction
    backend_construction --> error_event : LLM_BACKEND unset/unknown
    backend_construction --> security_gate
    security_gate --> error_event : request.security_hold
    security_gate --> ingestion
    ingestion --> retrieval
    retrieval --> synthesis : attempt 1
    synthesis --> gatekeeper : stream collected
    gatekeeper --> done_event : passed (+ eval_structural, ref hash)
    gatekeeper --> synthesis : failed, attempt < 3
    gatekeeper --> error_event : failed, attempt == 3
    ingestion --> error_event : unhandled exception (broad catch)
    retrieval --> error_event : unhandled exception (broad catch)
    done_event --> [*]
    error_event --> [*]
```

Retry semantics: only the **synthesis → gatekeeper** pair retries
(`MAX_RETRIES = 3`); ingestion/retrieval failures are not retried (retrieval
by design cannot fail — generic fallback). `retry_count` rides along in
`PipelineState` and is reported on the terminal `ErrorEvent`.

## SimPhase — frontend POC flow

Type: `src/types.ts`; driven by the POC panels in `src/components/poc/`.
This is UI presentation state, not backend state — it maps SSE events (or the
offline simulation) onto panels.

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> loading : start pipeline (PipelineStartPanel)
    loading --> done : DoneEvent / sim complete
    done --> review : open ReviewPanel (+ ExceptionsPanel if flags)
    review --> submitted : approve & transmit (SubmittedPanel)
    submitted --> round2_loading : payer counter-offer → dispute
    round2_loading --> round2_done : round-2 letter ready
    round2_done --> round2_submitted : approve & transmit round 2
    round2_submitted --> [*]
```

## Cross-machine mapping

| Pipeline outcome | SSE terminal | CaseStatus effect | SimPhase effect |
| --- | --- | --- | --- |
| Gatekeeper passed | `done` | processing → ready_for_review | loading → done |
| Security hold | `error` | → exception (human review of the document) | loading → error banner |
| Retries exhausted / node exception | `error` | stays processing / manual retry | loading → error banner |
| Reviewer approves | — | ready_for_review → submitted | review → submitted |
| Payer counter-offer | — | payer_response → processing (round 2) | submitted → round2_loading |
