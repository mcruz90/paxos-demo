# 11 — Sprint Plan (revised 2026-07-02)

*Sequenced sprint-by-sprint plan; [10-roadmap-traceability.md](10-roadmap-traceability.md)
holds the component/ADR mapping, this doc holds the order and slice-level
scope. Revised after three same-day events: the `project-review-hardening`
pass landed (14 fixes — see
[/docs/project-review-hardening.md](../project-review-hardening.md)), this
architecture suite was written, and May confirmed
[ADR-0001](adr/0001-langgraph-target-orchestrator.md): **LangGraph is the
de-facto framework for nodes/agents — state management, retries, and
checkpointing come from the framework, not hand-rolled code.***

## What changed vs. the pre-hardening roadmap

| Change | Why |
| --- | --- |
| LangGraph migration moved **S3 → Sprint 2 Slice 0** | User decision (2026-07-02) + the initial-PA flow is itself conditional (approved / pended-loop / denied→handoff), which trips ADR-0001's trigger before TierRouter does. Building S2 on the interim loop would violate the "no orchestration features on the hand-rolled loop" rule. |
| AuditRecord + correlation_id + idempotency pinned to **Sprint 2** | Was vaguely "cross-cutting"; hardening review found the schema existed but nothing wrote it. CLAUDE.md's Durability/Observability rules are tagged TARGET and name S2 as owner. |
| `CriterionResult.confidence` pinned as **Sprint 3 Slice 1** | Tier routing depends on numeric confidence bands; the field ripples through `types.ts`, the parity guard, `fixtures_adapter`, and golden labels — land it spec-first before any TierRouter code. |
| Claim→citation must be **blocking by end of Sprint 4** | AI-accountability rule: evals score, the gatekeeper blocks. A dashboard metric alone doesn't satisfy the no-uncited-claim rule. |
| Sprint 2 must **not extend `AppealRequest`** | Lifecycle-named request schema instead; `AppealRequest` stays appeal-shaped. |
| Every sprint updates `docs/architecture/` in the same PR | New CLAUDE.md rule; drift-from-chat-history was the root cause this suite exists to fix. |
| CI gates already tightened | vitest and pip-audit now gate every sprint's PRs (hard-12); keep them green, no `\|\| true` escapes. |

## Sprint 2 — Initial-PA lifecycle *(next; branch off `project-review-hardening`)*

**Goal:** the backend executes the initial-PA flow end-to-end per
[05-state-lifecycle.md](05-state-lifecycle.md): CRD check → assemble →
PAS submit (stub rail) → determination (approved / pended loop / denied →
`appealHandoff` into the existing appeal pipeline) — with an audit trail.

| Slice | Scope | Notes |
| --- | --- | --- |
| **0 — LangGraph migration** | Re-add `langgraph` + `langchain-core>=1.3.3,<2.0.0` via the §Dependency Security pre-install protocol (flag package list incl. transitives — langgraph-checkpoint/prebuilt/sdk, ormsgpack, xxhash, zstandard — then pip-audit). Rewrite `agents/graph.py` as `StateGraph(PipelineState)`. | Executes ADR-0001. `run_pipeline` signature + SSE contract unchanged; nodes untouched (already `(state) → state`); security-hold gate and the done\|error boundary carry over. **Acceptance: the full 425-test suite passes unmodified.** |
| **1 — Spec-first schemas** | New lifecycle-named request/response models (e.g. `InitialPaRequest`, determination payloads) in `models/schemas.py`; reuse existing `PaRequired` / `PaOutcome` / `AppealHandoff`. Any new enum gets a `types.ts` mirror + `test_schema_parity.py` coverage. | Do NOT extend `AppealRequest`. Update [03](03-domain-model.md) + [06](06-api-contract.md) in-PR. |
| **2 — CRD + assemble nodes** | `agents/nodes/` gains CRD-check and PA-assembly nodes; conditional edge for "PA not required" early exit. | First real use of LangGraph conditional edges. |
| **3 — PAS rail + determination** | Stub PAS rail adapter (adapter pattern: canonical in, PAS/X12-278 shape out — rail-accurate per [05-state-lifecycle.md](05-state-lifecycle.md): appeals never ride PAS); determination handling incl. pended loop and denied → `appealHandoff` into the appeal graph. | Adapter lives under `etl/`/rail module, engine never branches on payer. |
| **4 — AuditRecord write path** | Provenance field (`as_is` \| `gatekeeper_corrected` \| `human_edited`) added spec-first; `correlation_id` threaded request → events → record; idempotency key = `case_id` + attempt (new ADR); in-memory `list[AuditRecord]` pre-DB, written before the terminal event. Covers BOTH lifecycles. | Clears the CLAUDE.md TARGET tags on Durability/Observability/AuditRecord-provenance. Record `pa_resolution` (hard-5) in the audit entry. |
| **5 — API surface** | Initial-PA endpoint (SSE, same done\|error contract, Bearer auth); update [06](06-api-contract.md). **Stretch:** an upload route wiring `process_denial_letter` → pipeline — the ETL is currently unreachable from any route, and `security_hold` enforcement now exists end-to-end, so this is finally safe. | |

**Exit criteria:** initial-PA scenarios from the golden set run through the
LangGraph pipeline under `LLM_BACKEND=mock` (the mock is scenario-aware since
hard-4); every run writes exactly one AuditRecord with correlation_id +
provenance; retried requests don't double-write; docs 02/03/05/06 updated;
all CI gates green.

## Sprint 3 — HITL tiering

**Goal:** deterministic tier routing (routine / complex / exception) after the
gatekeeper — the compliance-critical HITL story.

| Slice | Scope | Notes |
| --- | --- | --- |
| **1 — `CriterionResult.confidence`** (spec-first, FIRST) | Add the 0–1 field backend + `types.ts` + parity test + `fixtures_adapter` + golden labels. | Everything else in S3 depends on it; it's the widest-rippling change, so it goes alone in one slice. |
| **2 — TierRouter node** | `agents/nodes/tier_router.py`, pure + deterministic: all ≥0.95 & first-pass gatekeeper → routine; any 0.70–0.94 or counter-offer or first drug/plan pairing → complex; any <0.70/missing, gatekeeper 3×, novel denial reason, **or `pa_resolution == "generic"`** → exception. `CaseTier` becomes a backend enum (mirror + parity). | **Never an LLM deciding tier** — regulatory + safety constraint (Illinois, MD HB 1563). The generic-fallback signal from hard-5 finally has its consumer. |
| **3 — Wire tier through** | Conditional edge post-gatekeeper; `tier` on `DoneEvent` + AuditRecord; frontend keys review UI off it (streamlined card / full letter / exception report already exist in the demo UI). | Escalation paths + review tiers are **platform policy inherited by all packs**, not per-pack (platformization memory). |
| **4 — Exception interrupt (scoped)** | LangGraph checkpoint/interrupt for the exception queue: persist run state so a human can resume. **Staged into three thin slices** (the "keep minimal" fork, resolved with May 2026-07-04 — do all of it, but in series, not one fat slice): **4a** checkpoint + interrupt on the exception tier, resume test-proven ([ADR-0010](adr/0010-in-memory-checkpointer-exception-interrupt.md)) — **Live** 2026-07-04; **4b** `POST /api/appeal/resume` endpoint (Bearer, SSE, idempotent, audited — `resume_finalize` node, distinct `human_edited` record per the ADR-0009 resume amendment) — **Live** 2026-07-04; **4c** frontend HITL resume UX — **DEFERRED** (decision 2026-07-04): the POC has *no* live backend wiring at all (fully simulated), so 4c is not a slice but the start of a frontend↔backend integration workstream (SSE client, browser auth-token strategy, live run lifecycle) — moved to Unscheduled below. | This is why the framework was chosen; don't hand-roll it. 4a compiles the appeal graph with `InMemorySaver` (`thread_id = correlation_id`); isolation preserved because keyed, not shared (ADR-0010). |

**Sprint 3 closes at Slice 4b (2026-07-04).** Slices 1–3 + 4a + 4b are live:
the compliance-critical HITL story — confidence-banded deterministic tier
routing (never an LLM) → exception-tier checkpoint/interrupt → human-resumable
via `POST /api/appeal/resume` → dual audit trail (`as_is` draft +
`human_edited` sign-off) — is complete and end-to-end tested at the
backend/API level. The remaining piece (4c) is presentation and is gated on a
frontend-integration effort that does not yet exist.

## Sprint FI — Frontend ↔ backend live integration *(promoted from Unscheduled 2026-07-05; branch `frontend-integration`)*

**Goal:** the first live API calls from the SPA — absorbing S3 Slice 4c. The
POC's simulated flow **stays the default** (the demo deploys as a static site
with no backend — dual-branch strategy); live mode is an explicit opt-in via
`VITE_API_BASE_URL`, behind a single mode seam, never per-component branching.

Between-sprint prep (2026-07-04/05, architect review after S3 close): 01
refreshed to post-S3 reality; `agents/graph.py` split (`generate.py` /
`resume.py` beside the graph substrate); `models/schemas.py` split into the
`models/` package behind the `models.schemas` facade; introspection endpoints
`GET /api/audit/records` + `GET /api/reviews/pending`
([ADR-0011](adr/0011-audit-trail-as-review-queue-index.md): the audit trail is
the queue index) + `tools/smoke_tour.py`.

| Slice | Scope | Notes |
| --- | --- | --- |
| **1 — Generated wire types** | `openapi.json` dumped deterministically from the app (`tools/dump_openapi.py`; SSE event models registered via `openapi_ext.py`) → `src/generated/api-types.d.ts` via `openapi-typescript` (dev-only); CI freshness job fails on stale artifacts; registration-parity unit test guards the hand-maintained SSE model list. | **Live** 2026-07-08. [ADR-0012](adr/0012-generated-wire-types-from-openapi.md): Pydantic is the authored source; TS wire types are a build product. Replaces hand-parity for wire shapes. |
| **2 — Session-cookie BFF auth** | FastAPI is its own BFF: `POST /api/auth/login`/`logout`, `GET /api/auth/me`; httpOnly `paxos_session` cookie (30-min TTL, in-memory store `security/sessions.py`) beside the unchanged Bearer path; CSRF double-submit on cookie writes; CORS tightened to `CORS_ORIGINS`; `AuditRecord.reviewed_by` attribution on cookie-authenticated resume. | **Live** 2026-07-09. [ADR-0013](adr/0013-fastapi-bff-session-cookie-auth.md) records the auth fork (SPA-held token / separate BFF / **FastAPI-as-BFF — chosen**). `sse.py` extracted from `main.py` (300-line cap). Real IdP (OIDC / SMART on FHIR) staged to Phase 3 — the session seam is IdP-pluggable by design. |
| **3 — Typed SSE client** | `src/lib/`: pure incremental `text/event-stream` frame parser + typed route wrappers over `fetch` (the SSE routes are POST — native `EventSource` cannot call them); cookie credentials + `X-CSRF-Token`; in-stream failures are terminal `error` events, not exceptions. Library-only, no UI. | **Live** 2026-07-09. Built in parallel with Slice 2 against the fixed contract; no reconnect/retry machinery by design. |
| **4 — Live POC wiring** | Login form (live mode only), streaming generate onto the existing POC states, pending-review queue from `/api/reviews/pending`, exception resume UX (approve as-is / edit → `POST /api/appeal/resume`); reconcile stale `VITE_API_KEY` doc mentions in favour of cookie/CSRF. | In progress 2026-07-09. This is S3 Slice 4c, landed last because it needs Slices 1–3. |

**Exit criteria:** simulated-mode build byte-behavior unchanged without
`VITE_API_BASE_URL`; live end-to-end manually verified (login → streaming
generate → exception parks → pending queue → resume with edit → dual
`as_is`/`human_edited` audit records with `reviewed_by`); full suites + wire-
types freshness green; post-sprint code review + security review pass with the
simplicity mandate (no defensive branching for states the contract rules out).

## Sprint 4 — Eval suite

**Goal:** the golden set becomes an executable quality gate.

- `evals/run_evals.py` CLI (never in CI; provider-parametric via the
  `LLMBackend` seam — evals can compare providers, which feeds the open
  provider decision).
- Dimension scorers against golden labels — the `EvalDimension` vocabulary
  already exists (coverage, structure, safety, claim_citation, over_caution);
  claim→citation scorer consumes the `GroundingRef` claim→span labels.
- **Claim→citation becomes a BLOCKING gatekeeper check** once the scorer is
  trusted on the golden set — evals score, the gatekeeper blocks; this is
  what closes the AI-accountability rule. Update the AuditRecord provenance
  when the gatekeeper corrects.
- **Resume-path gatekeeper:** route human-edited resumed letters through the
  deterministic gatekeeper before `resume_finalize`, and set
  `gatekeeper_passed` from the actual result (security-review informational
  finding, 2026-07-09 — today the resume `AuditRecord` stamps
  `gatekeeper_passed=True` for a letter the gatekeeper never saw).
- Redteam/adversarial fixtures wired as a standing regression suite.
- Eval gate as the promotion mechanism for pack/prompt/instruction changes
  (versioned + eval-gated + audited — the artifact-versioning pattern),
  which S5 onboarding then reuses as its go-live gate.

## Sprint 5 — Platformization

- Coverage-based pack resolution: BIN/PCN/Group + market/tier via
  `golden/coverage_pool.json` (`_s5_coverage_hook` is already in
  `pa_requirements.json`); `PaResolution` literal grows (e.g. `coverage`,
  `synthesized`) — update event/audit consumers and the parity surface.
- `etl/policy_ingest/` + Qdrant vector retrieval (re-vet `qdrant-client`,
  `sentence-transformers` per ADR-0007; new ADR for the vector-store choice).
- `SourceAdapter` ABC → `CanonicalRecord`; EHR/FHIR is one adapter among the
  connector catalog, not the default.
- Onboarding-as-configuration validation = run the S4 eval suite against the
  client's config before go-live.

## Sprint 6 — Sponsor analytics + affordability handoff

- Affordability/PSP handoff, **represent-not-operate**: detect the gap,
  recommend the program type gated on `market = commercial`, route via
  `WorkflowPlan` — never adjudicate eligibility.
- Sponsor dashboards aggregate from the AuditRecord trail (exists since S2),
  keeping the eval-scores-vs-outcomes story consistent with the demo UI.

## Unscheduled (trigger-based, not sprint-bound)

| Item | Trigger |
| --- | --- |
| ~~Frontend ↔ backend live integration~~ | **Promoted to Sprint FI (2026-07-05)** — see the sprint section above. The auth-token question it flagged was resolved as FastAPI-as-BFF session cookies ([ADR-0013](adr/0013-fastapi-bff-session-cookie-auth.md)). |
| Langfuse tracing | After S2 (correlation IDs exist to propagate). Re-vet its network behavior first (ADR-0007 telemetry clause); `redact_phi` on every payload; best-effort try/except. |
| PostgreSQL durable audit | Phase 3 / first hosted deployment — replaces the in-memory list; persistence before `done` per ACID §Durability. |
| Hosted backend checklist | CORS tightening, rate limiting (`slowapi` re-entry), deploy target ([08](08-deployment-ci.md)). |
| E2E unblock | Blocked on the landing-flow UX decision ([frontend-e2e-debt](../frontend-e2e-debt.md)); then re-point `skipToQueue()` + specs. |
| `scenarios.tsx` split | Post-demo (documented CLAUDE.md debt). |
