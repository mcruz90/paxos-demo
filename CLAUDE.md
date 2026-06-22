# ClearAuth Development Standards

## TDD — Tests Before Code
- Write a failing test BEFORE writing production code. No exceptions for backend code.
- Red → Green → Refactor. Commit each phase separately.
- A feature is not "done" until its tests pass in CI without mocks leaking into production paths.
- Frontend: write Vitest unit tests for any function extracted from the component tree.

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
- **Frontend layout (post-demo):** Extract components from `src/App.tsx` into `src/components/`, hooks into `src/hooks/`, types into `src/types.ts`. App.tsx's current god-file form is intentional demo-only tech debt — documented here as such.
- Never put a new feature into an existing large file to avoid a split. Split first.

## DRY — Single Source of Truth
- Extract shared logic on the second occurrence, not the third.
- Shared types live in `backend/models/schemas.py` (backend) and `src/types.ts` (frontend). Never redefine a type inline.
- The 6 scenario fixtures in `backend/evals/fixtures/scenarios.json` are the canonical test dataset. `backend/data/pa_requirements.json` is seeded from them. Never duplicate scenario data ad hoc in test files — import the fixture.
- Prompt templates live in `backend/third_party/fhi/prompt_templates.py` or `backend/agents/prompts.py`. Never inline a multi-line prompt string in a node file.

## ACID — Transactional State
- **Atomicity:** LangGraph nodes are all-or-nothing. A node either completes its full state update or raises — it never partially mutates state and returns.
- **Consistency:** `PipelineState` is the single source of truth for in-flight pipeline state. No side-channel passing via globals or closures.
- **Isolation:** Each pipeline run gets its own `PipelineState` instance. Runs must not share mutable state.
- **Durability:** When Phase 3 PostgreSQL is wired in, every completed run must be persisted before the SSE `done` event is emitted. Pre-DB: append runs to an in-memory `list[AuditRecord]` that survives the request lifecycle; reset only on server restart.

## Defensive Programming
- **Validate at every boundary.** HTTP request bodies, LLM output, file reads, external API responses — all validated with Pydantic before use. No raw dicts in business logic.
- **Fail fast, fail loudly.** Raise specific typed exceptions (`GatekeeperError`, `ContextWindowError`, `RefusalDetectedError`, `ETLParseError`). Never `except Exception` broadly and swallow it.
- **Never trust LLM output.** Every string returned by the model passes through the deterministic gatekeeper before any downstream use. No exceptions, even for "obviously safe" scenarios.
- **Explicit over implicit.** If a function can fail, its return type must reflect that. No silent `None` returns for error states — use `raise` or a typed `Result` wrapper.
- **External APIs can be down.** Ollama, Groq, and Langfuse calls must all have explicit timeouts. A Langfuse outage must never block appeal generation — trace calls are best-effort, wrapped in `try/except`.

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

## Attribution
- All files under `backend/third_party/fhi/` are forked from [Fight Health Insurance](https://github.com/fighthealthinsurance/fighthealthinsurance), Apache 2.0. Preserve original copyright headers. Note changes in a comment at the top of each modified file.
