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
    exception --> awaiting_documentation : outbound doc workflow dispatched (queue workspace)
    ready_for_review --> submitted : reviewer approves & transmits
    submitted --> payer_response : payer determination received
    payer_response --> [*] : accepted / closed
    payer_response --> processing : dispute → next round
    payer_response --> ready_for_review : counter-offer disputed inline (queue workspace)
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
- **Exception resolution never skips the approval gate.** The queue workspace
  (`src/components/portfolio/`) lets a coordinator resolve each flagged
  criterion by dispatching its outbound workflow or overriding the finding
  with a rationale. A fully resolved case routes to `awaiting_documentation`
  if any workflow was dispatched (we now wait on the provider), otherwise to
  `ready_for_review` — never straight to `submitted`; only the explicit
  approve action transmits (`statusAfterResolution` in
  `src/components/portfolio/caseQueue.ts`, unit-tested).
- The inline payer-response dispute (queue workspace) returns the case to
  `ready_for_review` because the next-round letter is already drafted; the
  POC round-2 flow goes through `processing` because it regenerates the
  letter. Both edges are real, at different surfaces.

## CaseLifecycle — which artifact is being produced

```mermaid
stateDiagram-v2
    state initial_pa {
        [*] --> crd_check : PA required? (paRequired)
        crd_check --> assemble : yes — build structured PA request
        assemble --> pas_submit : transmit (PAS rail)
        pas_submit --> determination : paOutcome
        determination --> [*] : approved — patient on therapy
        determination --> [*] : pended — unresolved evidence
    }
    initial_pa --> appeal : paOutcome denied — human starts appeal from appealHandoff
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
    retrieval --> synthesis : compatible policy
    synthesis --> gatekeeper : stream collected
    gatekeeper --> tier_router : passed
    tier_router --> finalize : tier assigned (+ eval_structural, ref hash)
    finalize --> done_event
    done_event --> hold : tier == exception (park for human review)
    gatekeeper --> synthesis : failed, attempt < 3
    gatekeeper --> error_event : failed, attempt == 3
    ingestion --> error_event : unhandled exception (broad catch)
    retrieval --> error_event : policy hold or unhandled exception
    done_event --> [*] : routine / complex
    hold --> [*] : parked — first stream ends; resume is a separate request
    error_event --> [*]
```

Only the **synthesis → gatekeeper** pair retries, up to three attempts.
A policy hold ends the run with its reason and next action. The terminal
ErrorEvent reports the retry count from PipelineState.

Tier routing (S3 Slice 3): a gatekeeper pass runs **tier_router** — the
deterministic HITL router (never an LLM; Illinois, MD HB 1563) — before
`finalize`, so the terminal `DoneEvent` and the `AuditRecord` carry the
review tier (`routine` / `complex` / `exception`). The exhausted branch
(`error_event`) produced no letter, so it carries **no** tier — tier is a
property of a produced artifact, and `decide_tier`'s gatekeeper-exhausted →
exception rule is therefore unreachable from this wired path (the exhausted
branch intercepts `>= MAX_RETRIES` first) and stays a defensive completeness
guard, exercised only in `decide_tier`'s unit tests.

Exception-tier park (S3 Slice 4a; [ADR-0010](adr/0010-in-memory-checkpointer-exception-interrupt.md)):
after `finalize` emits the `DoneEvent` for an `exception` run, a post-finalize
conditional edge sends it to the **`hold`** node, which calls `interrupt()` —
the run parks at a durable checkpoint keyed by `thread_id = correlation_id`
so a human can resume it. Because the `DoneEvent` was already emitted, the SSE
stream still terminates with `done` (no new terminal type); the interrupt
surfaces on LangGraph's `updates` channel, which the custom stream does not
forward, so the client's stream simply ends. Routine/complex runs skip `hold`
and go straight to `[*]`.

Resume (S3 Slice 4b) is a **separate request** — `POST /api/appeal/resume`
with the parked run's `correlation_id`. `run_resume` re-enters the graph at
`hold` via `Command(resume={"edited_text": …})`; `hold` applies the reviewer's
edit, then `resume_finalize` emits a fresh `done` terminal for the cleared
letter. That resume stream writes its own `human_edited` `AuditRecord`
(distinct `idempotency_key`, same `correlation_id`), so the trail holds the
machine draft and the human sign-off side by side. Resuming a run that is not
parked (unknown id, or already resumed) is a terminal `error` with no audit —
resume is idempotent. The HITL UX that calls this endpoint is Slice 4c.

## Initial-PA pipeline run — one request (S2)

Source: [backend/agents/initial_pa_graph.py](../../backend/agents/initial_pa_graph.py).
Same terminal guarantee as the appeal run (`done` | `error`); no LLM, no
chunks. The run implements the `initial_pa` lifecycle above end-to-end:

```mermaid
stateDiagram-v2
    [*] --> security_gate
    security_gate --> error_event : request.security_hold
    security_gate --> pa_ingestion
    pa_ingestion --> crd_check
    crd_check --> done_event : unknown — policy hold before assembly
    crd_check --> pa_assembly : PA required
    pa_assembly --> pas_submit : canonical PaSubmission → rail adapter
    pas_submit --> determination
    determination --> done_event : approved, pended, or denied (denial includes appealHandoff)
    pa_ingestion --> error_event : unhandled exception (broad catch)
    crd_check --> error_event : unhandled exception (broad catch)
    done_event --> [*]
    error_event --> [*]
```

**Stub determination semantics.** The current submission finalizes after one
determination. Any `conflict` yields a denial with an `AppealHandoff` carrying
`case_ref`. A person can use that pointer to start a separate appeal. Otherwise,
empty evidence or any `needs_review` yields `pended`, and non-empty evidence
with every criterion `found` yields `approved`. Replaying the same unresolved
evidence leaves the PA pending. Advancing it requires new evidence or an
explicit payer response. Payer-response handling is outside this submission flow.

**Stub CRD semantics:** the pa_requirements registry stands in for the
payer's CRD endpoint. A compatible policy yields a PA-required verdict. An
unresolved policy yields an unknown verdict (`pa_required.required = null`)
with a reason and next action. The run exits before assembly for human
review (ADR-0018). A pack for this drug under another plan does not count
(ADR-0019). The registry never answers "PA not required"; only a real payer CRD
query can.

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
