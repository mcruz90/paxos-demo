# ClearAuth Development Standards

## TDD — Tests Before Code
- Write a failing test BEFORE writing production code. No exceptions for backend code.
- Red → Green → Refactor. Commit each phase separately.
- A feature is not "done" until its tests pass in CI without mocks leaking into production paths.
- Frontend: write Vitest unit tests for any function extracted from the component tree.
- **Spec-first.** Before implementing a handler or node, write/update its Pydantic schema (request/response, new `PipelineState` fields) first. The schema is the contract; the test verifies behavior against that contract — spec-first and test-first are the same discipline applied to shape vs. behavior.

## File Organization — No God Files
- **One responsibility per file.** Max ~300 lines per `.py` or `.tsx` file. Growing past that signals a split.
- **Backend layout (strictly by layer):**
  - `api/` — FastAPI route handlers only. No business logic.
  - `agents/nodes/` — One file per LangGraph node. Nodes are pure functions: `(state) -> state`.
  - `etl/` — One subdirectory per data source. Orchestration in `pipeline.py`, steps in separate files.
  - `ml/` — LLM backend abstractions. No domain logic.
  - `evals/` — Scoring functions and CLI runner. No app code.
  - `models/` — Pydantic schemas. No logic.
  - `third_party/fhi/` — Forked files from fighthealthinsurance. Minimal modifications only.
- **Where business logic lives.** A node's (or route handler's) top-level function is orchestration only — it unpacks `PipelineState` (or a request), calls plain functions for the actual rule/algorithm, and repacks the result. Those plain functions take and return typed values, never `PipelineState`, a live DB/HTTP connection, or a FastAPI request/response — so each one is unit-testable in isolation with literal inputs and plain assertions: no mocked DB, no test double for another service, no dependency on some other node having already run. Any I/O the logic needs (loading a file, querying a DB) happens in a separate step before the pure function is called, not inside it. See `agents/nodes/retrieval.py` — `_load_requirements()` does the I/O once, the plan_id → alias → generic resolution is the pure, independently testable part. Keep the logic private to its node file until a second consumer needs it, then extract it to its own module (per the DRY rule below) — `api/` and `models/` stay logic-free by definition, they never grow an exception to this.
- **Frontend layout (post-demo):** Extract components from `src/App.tsx` into `src/components/`, hooks into `src/hooks/`, types into `src/types.ts`. App.tsx's current god-file form is intentional demo-only tech debt — documented here as such. `src/data/scenarios.tsx` (500+ lines of scenario fixture data) is the same kind of intentional demo-only tech debt — split into `src/data/scenarios/` (one file per anchor) post-demo rather than mid-sprint.
- Never put a new feature into an existing large file to avoid a split. Split first.

## DRY — Single Source of Truth
- Extract shared logic on the second occurrence, not the third.
- Shared types live in `backend/models/schemas.py` (backend) and `src/types.ts` (frontend). Never redefine a type inline.
- The 6 scenario fixtures in `backend/evals/fixtures/scenarios.json` are the canonical test dataset. `backend/data/pa_requirements.json` is seeded from them. Never duplicate scenario data ad hoc in test files — import the fixture.
- Prompt templates live in `backend/third_party/fhi/prompt_templates.py` or `backend/agents/prompts.py`. Never inline a multi-line prompt string in a node file.

## Domain Research — New Claims vs. Deeper Dives
- **New domain claim → research it, don't guess.** If a task introduces a drug, payer policy, or clinical criterion that is not already represented in `backend/evals/fixtures/scenarios.json` or the golden set (e.g. "add a Repatha case"), do not invent plausible-sounding PA requirements. Use WebSearch to find the payer's actual policy or the drug's FDA label/clinical guideline, cite the source, and state a confidence level. If no authoritative source turns up, say so explicitly instead of presenting a guess as fact.
- **Existing golden-set case needing a deeper dive → prompt the user, don't auto-research.** If the case is already in the golden set and the ask goes beyond a quick sanity check (e.g. re-verifying step-therapy specifics, disputing a fixture's accuracy), flag that this warrants the user's own deeper-dive research rather than burning a research pass automatically. This keeps latency down for cases already explored together.
- This is the applied form of the regulatory grounding pattern: hypothesize → verify against an authoritative source → cited, confidence-scored, human-gated.

## ACID — Transactional State
- **Atomicity:** LangGraph nodes are all-or-nothing. A node either completes its full state update or raises — it never partially mutates state and returns.
- **Consistency:** `PipelineState` is the single source of truth for in-flight pipeline state. No side-channel passing via globals or closures.
- **Isolation:** Each pipeline run gets its own `PipelineState` instance. Runs must not share mutable state.
- **Durability:** When Phase 3 PostgreSQL is wired in, every completed run must be persisted before the SSE `done` event is emitted. Pre-DB: append runs to an in-memory `list[AuditRecord]` that survives the request lifecycle; reset only on server restart.

## Defensive Programming
- **Validate at every boundary.** HTTP request bodies, LLM output, file reads, external API responses — all validated with Pydantic before use. No raw dicts in business logic.
- **Fail fast, fail loudly.** Raise specific typed exceptions (`GatekeeperError`, `ContextWindowError`, `RefusalDetectedError`, `ETLParseError`). Never `except Exception` broadly and swallow it.
- **Never trust LLM output.** Every string returned by the model passes through the deterministic gatekeeper before any downstream use. No exceptions, even for "obviously safe" scenarios.
- **Never let the thing that produced the output grade it.** The gatekeeper, evals, and any verification step must be separate code paths from generation — never a second prompt to the same model asking "is this okay?" Applies equally to Claude Code's own work: for non-trivial features, an independent review pass (`/code-review`) is the verification step, not "the tests I just wrote pass."
- **Explicit over implicit.** If a function can fail, its return type must reflect that. No silent `None` returns for error states — use `raise` or a typed `Result` wrapper.
- **External APIs can be down.** Ollama, Groq, and Langfuse calls must all have explicit timeouts, exponential backoff with a bounded retry count, and a short-circuit after repeated failures — never hammer a degraded dependency. A Langfuse outage must never block appeal generation — trace calls are best-effort, wrapped in `try/except`.

## AI Output Accountability
- **No uncited claim in outbound artifacts.** Every clinical or factual claim in an appeal letter, PA submission, or other payer-facing artifact must trace to a verbatim chart fact or a cited policy statement before it is allowed out. The company is liable for what its AI generates the same way it would be for a human agent's words or a signed contract — courts have held companies to their chatbots' promises (Air Canada) and to AI-generated summaries as their own editorial content (2026 German ruling against Google's AI Overviews). "The user could have checked" is not a defense, and it isn't one for ClearAuth either.
- **`AuditRecord` distinguishes AI-generated from human-reviewed content.** Every audit entry marks whether the outbound text was model output as-is, model output after gatekeeper correction, or human-edited/approved — so there is a record of what was actually verified before it reached a payer, not just that a pipeline ran.

## Architecture Patterns — Adapter & Strategy
- **Adapter pattern for connectors.** `etl/` (and future payer/EHR integrations) translate a source-specific shape into the canonical schema in `backend/models/schemas.py` before anything downstream touches it. Engine/agent code never branches on payer name, EHR vendor, or source format — that logic lives entirely in the adapter.
- **Strategy pattern for LLM backends.** `ml/` exposes swappable backends (Ollama, Groq, etc.) behind one common interface. Nodes call the interface, never a provider SDK directly — swapping or adding a backend must not touch `agents/nodes/`.
- These aren't new rules so much as naming what the platformization direction already assumes ([[project_platformization_architecture]]) — codified here so connector/backend code is structured consistently as it's built out, not just in the demo UI.

## Observability & Reliability
- **Correlation IDs.** Every pipeline run carries one `correlation_id` (or `case_id` if it already uniquely identifies the run), propagated through logs, Langfuse traces, and the `AuditRecord`. A failure must be traceable end-to-end from a single ID, without correlating on timestamps or content.
- **Idempotency.** Any endpoint or node that submits to an external payer or writes an `AuditRecord` must be idempotent. A retried request (client timeout, network blip, SSE reconnect) must never double-submit an appeal/PA or double-write an audit entry. Derive an idempotency key from `case_id` + submission attempt, not from wall-clock time.

## Security Defaults
- PHI never enters log files or Langfuse trace payloads unredacted. Always call `redact_phi()` before logging any text that touched a denial letter or patient record.
- `.env` is gitignored. Hard-coding API keys anywhere in the codebase is a blocking PR comment.
- All `/api/*` routes require `Authorization: Bearer <API_SECRET_KEY>`. Adding an unauthenticated route requires explicit justification in the PR description.
- Untrusted text (denial letters, payer responses, user-uploaded documents) is always wrapped in XML delimiters inside prompts — never string-interpolated raw into the prompt body.
- `pytesseract`, `pymupdf`, and `dspy` process untrusted documents. Always enforce file size and type limits before passing data to these libraries. (`easyocr` was removed — last major update 2021, PyTorch dep chain too large for PHI context.)

## Dependency Security — Check Before Every Install
**Never run `uv add`, `pip install`, `npm install`, `npm add`, or add any package to `pyproject.toml` / `package.json` without completing these steps first. No exceptions. This applies to both backend (Python/PyPI) and frontend (Node/npm).**

### For every package addition (Python or JavaScript):
1. **Flag the full package list to the user** — list every package you intend to add (including known transitive ones) and wait for acknowledgment before running any install command.
2. **Search for active supply chain attacks** — query `"<package> malware npm/PyPI"`, `"<package> CVE 2025 2026"`, and `"<package> supply chain attack"`. The LiteLLM incident (early 2026, CVE-2026-40217) is the canonical example: the official package shipped code that exfiltrated API keys.
3. **Check the registry for typosquatting lookalikes** — confirm the canonical package name on PyPI or npmjs.com; search for near-name variants (e.g. `easy-ocr`, `langraph`, `langfuse2`, `reacts`, `lodahs`).
4. **Run an audit after install:**
   - Python: `uv run pip-audit` — catches transitive CVEs
   - Node: `npm audit` — catches known vulnerabilities in the dependency tree
5. **Pin transitive security-critical deps explicitly** — e.g. `urllib3>=2.7.0`, `semver>=7.6.3` if a transitive version with a known CVE exists.
6. **For any telemetry/observability package (langfuse, Datadog, Sentry, etc.):** confirm exactly what network calls it makes on import and at runtime before adding it to a codebase that handles PHI.

If any package has an active unpatched CVE rated CVSS ≥ 7.0, or an unresolved supply-chain incident, **stop and discuss with the user before proceeding**.

## Collaboration — Stay in the Loop, Not on Autopilot
This isn't a code-quality rule — it's about keeping the user's own understanding of the system intact, so "we built it with Claude Code" doesn't quietly become "and nobody here can fix it when it breaks."
- **Explain non-obvious decisions, don't just implement them.** When a change involves a real judgment call (which pattern, which tradeoff, why this approach over an obvious alternative), say so in plain language before or while implementing — in chat, not buried in a comment. The goal is that the user could explain the decision to someone else afterward, not just approve a diff.
- **Surface real forks as questions, not silent choices.** This file's existing pattern (dependency-security acknowledgment, domain-research scoping) already does this in specific cases — keep extending it: when there's a genuine architectural fork, propose options and a recommendation and let the user pick, rather than picking silently because it's faster.
- **Don't let approval become a rubber stamp.** If the user is agreeing quickly across several asks in a row, that's a signal to slow down and confirm they've actually tracked the last decision, not a green light to speed up further.

## Attribution
- All files under `backend/third_party/fhi/` are forked from [Fight Health Insurance](https://github.com/fighthealthinsurance/fighthealthinsurance), Apache 2.0. Preserve original copyright headers. Note changes in a comment at the top of each modified file.
