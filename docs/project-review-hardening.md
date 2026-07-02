# Project Review Hardening

Identified during a whole-project review (2026-07-02) before Sprint 2
(Initial-PA lifecycle) implementation begins. The review looked for
contradictions between the product thesis and the build, CLAUDE.md adherence
gaps, and architecture debt. Recurring theme: **safety and accountability
mechanisms were built and tested, but never wired into the execution path.**

Process mirrors `backend-security-debt.md`: one RED commit + one GREEN commit
per behavioral item, single commits for refactors/chores/docs, full suite +
ruff + mypy at the end. Branch: `project-review-hardening` (off
`backend-security-debt`).

---

## Fixed in this pass

### hard-1. `security_hold` is set but never enforced

**Files:** `backend/agents/graph.py`, `backend/etl/denial_letter/pipeline.py`

The ETL pipeline sets `AppealRequest.security_hold` when a document is
flagged (injection phrases, bidi chars, hidden PDF text) — the
backend-security-debt pass hardened how the flag gets *set* — but nothing
downstream ever *reads* it. A held document flows straight into the LLM.
Detection without enforcement contradicts the product's "deterministic gates
around the model" thesis.

**Fix:** `run_pipeline` checks `request.security_hold` before any node runs.
Held requests emit a single `ErrorEvent` and terminate — the LLM backend is
never invoked (test asserts via spy). This is the pipeline-level enforcement
point; any future upload route inherits it.

### hard-2. Node exception mid-stream drops the SSE connection with no `error` event

**File:** `backend/main.py` / `backend/agents/graph.py`

SSE headers are sent before the pipeline runs. If any node raises
(e.g. `ETLParseError` from a malformed pa_requirements pack), the stream dies
with a bare disconnect — the client never receives an `error` event, and the
typed exceptions in `errors.py` never surface anywhere.

**Fix:** `run_pipeline` wraps execution so every stream terminates with
`done` or `error`, never a bare disconnect. Exception detail is logged
server-side (after `redact_phi`); the client receives a generic message.

### hard-3. Backend `CaseStatus` missing `awaiting_documentation`

**File:** `backend/models/schemas.py`

Frontend `CaseStatus` (src/types.ts) gained `awaiting_documentation` with the
PH-3101 doc-gap flow; the backend mirror was planned but never added. This is
exactly the contract-drift class Sprint 1 existed to eliminate — the parity
guard covers scenario *data*, not enum *shapes*.

**Fix:** Add the member; add an enum-parity unit test pinning the expected
value set.

### hard-4. MockLLMBackend is scenario-blind

**File:** `backend/ml/mock_backend.py`

The mock always returns a hardcoded Ozempic/T2DM letter. Any non-Ozempic
scenario run with `LLM_BACKEND=mock` fails the gatekeeper's drug/diagnosis
checks 3× and errors out. CI integration tests pass only because they use the
Ozempic scenario; Sprint 2 initial-PA scenarios would trip this immediately.

**Fix:** The mock parses the `Drug:` / `Diagnosis:` lines from the prompt and
embeds them in the letter, so it passes the gatekeeper for any scenario.

### hard-5. Retrieval resolution path is invisible downstream

**File:** `backend/agents/nodes/retrieval.py`, `backend/models/schemas.py`

Resolution falls back silently: exact plan_id → drug alias → generic
boilerplate. A letter generated from the *generic* fallback is a materially
different artifact (no payer-specific criteria) but nothing records which
path fired — not in state, not in the DoneEvent, so neither the future
AuditRecord nor the S3 TierRouter can see it. The demo UI already surfaces
this ("registry hit vs synthesized"); the backend had no equivalent signal.

**Fix:** `PipelineState.pa_resolution` ∈ {`plan_id`, `drug_alias`,
`generic`}, set by retrieval, emitted on `DoneEvent.pa_resolution`.

### hard-6. `ocr_consistency_check` silently skips unreadable pages

**File:** `backend/security/sanitize.py`

`except Exception: continue` inside the page loop means a PDF page whose
content stream fails to parse is silently excluded from the hidden-text scan.
In a security check, an unparseable page is itself a signal — a crafted page
that breaks `read_contents()` bypasses the scan entirely. Same class as
debt-5 (broad swallow), in the highest-stakes spot.

**Fix:** An unreadable page marks the result
`has_hidden_content=True, confidence=0.5, details="page N unreadable"` —
conservative direction: a hold routes to human review, it doesn't lose data.

### hard-7. `redact_phi` misses middle-initial names

**File:** `backend/security/redact.py`

Flagged in Sprint 0 as "backend-security-debt item 7" but the debt doc only
carried 6 items — it fell through. "John Q. Public" survives redaction (the
two-word pattern requires lowercase after each capital).

**Fix:** Add a `First M. Last` / `First M Last` pattern ahead of the two-word
pattern.

### hard-8. Groq backend violates the layer rule and the external-API rule

**File:** `backend/main.py` → `backend/ml/`

`_GroqBackend` was defined inline in `main.py` (not `ml/`), there was no
shared backend interface, and the client had **no timeout, no bounded retry,
no short-circuit** — all three are explicit CLAUDE.md requirements ("External
APIs can be down").

**Fix:** `ml/llm_backend.py` defines the `LLMBackend` Protocol — the
provider-neutral contract the pipeline codes against. **No provider is
committed:** the user is still evaluating LLM providers, so `main.py`'s
factory has no silent default (`LLM_BACKEND` must be set explicitly; unset
fails fast listing the options). Groq is just one implementation file
(`ml/groq_backend.py`) alongside `ml/mock_backend.py`; adding
Ollama/OpenAI/Anthropic later = one new module + one factory branch, zero
changes to `agents/`. The Groq implementation carries the required
resilience: explicit request timeout, the SDK's bounded exponential-backoff
retries, and a shared `CircuitBreaker` (fail fast during cooldown instead of
hammering a degraded dependency). Backend-construction failure inside the
SSE generator now yields an `error` event instead of a bare disconnect.

### refactor-9. The tested synthesis node was dead code

**Files:** `backend/agents/nodes/synthesis.py`, `backend/agents/graph.py`

`run_synthesis` was only called by its own unit tests; `graph.py`
reimplemented the same logic inline for streaming. The production path was
untested, the tested path unused — the exact "tests pass but don't test the
production path" failure CLAUDE.md warns about.

**Fix:** The node owns `build_prompt` + `apply_synthesis` (pure state
updater); the graph streams chunks and calls `apply_synthesis`. Dead
`run_synthesis` deleted; tests target the functions production actually runs.

### refactor-10. Multi-line prompt inline in a node file

**File:** `backend/agents/nodes/synthesis.py` → `backend/agents/prompts.py`

CLAUDE.md DRY rule: prompt templates live in `agents/prompts.py` or
`third_party/fhi/prompt_templates.py`, never inline in a node. Moved.

### chore-11. Unused declared dependencies

**File:** `backend/pyproject.toml`

`langgraph`, `langchain-core`, `langfuse`, `slowapi`, `pydantic-settings`
were declared with zero imports anywhere — pure supply-chain surface, and
`langfuse` is exactly the telemetry-in-a-PHI-codebase case the
dependency-security rules exist for. Moved to the existing "deferred"
comment block (the same treatment dspy/qdrant already had); re-adding
requires the standard pre-install check. Two survivors, both verified:
`loguru` looked unused but is imported by `third_party/fhi/generate_appeal.py`
(the fork has its own imports — always grep `third_party/` before pruning);
`python-dotenv` was unused but the README's `.env` workflow depends on it, so
it was kept and actually wired (`load_dotenv()` in `main.py`). `pip-audit`
clean after relock.

**LangGraph note:** README/pitch say "LangGraph DAG"; the code is a
hand-rolled async pipeline. Decision deferred to S3 (TierRouter is where
branching/checkpointing would earn it). Until then the dep is out and the
README says "LangGraph-style" honestly. Reversible in one line + relock.

### chore-12. CI gates that cannot fail

**File:** `.github/workflows/ci.yml`

- Frontend job ran `tsc && vite build` only — the 48 vitest tests (including
  the Sprint 1 anchor-join parity guard, the designated drift gate) never ran
  in CI. Added `npm test`.
- `pip-audit --desc || true` — the supply-chain audit could never fail the
  build. Removed `|| true`.
- Stale comment referenced `evals/run_evals.py`, which does not exist yet
  (S4). Reworded.

### docs-13. README materially wrong about the code

Documented an Ollama backend, per-node model selection, Langfuse tracing, and
DSPy — none exist. `LLM_BACKEND` default: README said `ollama`, code says
`groq` (and `ollama` isn't implemented). `GROQ_MODEL` defaults disagreed.
Rewritten to match reality, with planned items marked as planned.

### docs-14. CLAUDE.md fixes

- **Status tags** on aspirational rules (AuditRecord provenance, correlation
  IDs, idempotency, pre-DB audit list) — they were phrased in the present
  tense, so a parallel session reading CLAUDE.md cold would assume the
  infrastructure exists.
- **Enforcement-pairing rule:** every detection flag must have exactly one
  downstream enforcement point + a test that a held input cannot reach the
  LLM (the hard-1 failure mode, generalized).
- **SSE contract:** every stream terminates with `done` or `error`.
- **Dependency-removal rule:** a package stays in pyproject only while
  something imports it; future-sprint deps go in the deferred block.
- Stale frontend paragraph updated (App.tsx split is done).
- `schemas.py` docstring: types mirror `src/types.ts`, not `src/App.tsx`.

---

## Deliberately NOT fixed here (documented for the owning sprint)

| Item | Why deferred | Owner |
|---|---|---|
| AuditRecord runtime wiring + provenance field + correlation_id + idempotency | Real feature work; belongs in the S2 plan (spec-first: add fields when the write path lands, not as more defined-but-unused schema) | Sprint 2 |
| Claim→citation as a *blocking* gatekeeper check | Depends on the S4 eval suite; note: it must eventually block, not just score, to honor the AI-accountability rule | Sprint 4 |
| `CriterionResult.confidence` | Prerequisite for S3 tier routing; ripples through frontend contract + fixtures adapter + golden set, so land it as the first S3 slice, spec-first | Sprint 3 |
| LangGraph adoption decision | TierRouter (S3) is where branching/checkpointing would justify it | Sprint 3 |
| 10/13 failing e2e specs (`frontend-e2e-debt.md`) | Needs a UX decision on the landing→queue flow first | Frontend session |
| `redact_phi` over-redaction of Title-Case prose ("Medical Director") | Acceptable for log scrubbing (its only use); revisit if ever applied to letter text | When Langfuse lands |
| Retrieval import-time JSON load | Accepted: fail-fast at boot is intentional; revisit if packs become hot-reloadable | Sprint 5 |
| CORS `allow_origins=["*"]` | Deploy-time config; backend is not publicly deployed | Pre-deploy |
