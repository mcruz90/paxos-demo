# 08 — Deployment & CI

*Verified against source 2026-07-02 (branch `project-review-hardening`).
Sources: [.github/workflows/ci.yml](../../.github/workflows/ci.yml),
[app.yaml](../../app.yaml), [backend/pyproject.toml](../../backend/pyproject.toml).*

## CI pipeline

Runs on every push (all branches) and PRs to `main`. Four parallel jobs; all
are gates — no `|| true` escape hatches (chore-12 removed the pip-audit one).

```mermaid
flowchart LR
    push["push / PR"] --> fe & bu & bi & lint

    subgraph fe ["frontend-check (node 24)"]
        f1["npm ci"] --> f2["npm test<br/>(Vitest incl. scenarios_parity guard)"] --> f3["npm run build"]
    end

    subgraph bu ["backend-unit"]
        b0["apt: tesseract-ocr"] --> b1["uv sync --group dev"] --> b2["pip-audit --desc<br/>(CVE finding FAILS the build)"] --> b3["pytest tests/unit/test_golden_compliance.py<br/>(PHI + fixture-integrity scan)"] --> b4["pytest tests/unit tests/contract"]
    end

    subgraph bi ["backend-integration"]
        i0["apt: tesseract-ocr"] --> i1["uv sync --group dev"] --> i2["pytest tests/integration<br/>(MockLLMBackend — no network, no keys)"]
    end

    subgraph lint ["lint"]
        l1["uv sync --group dev"] --> l2["ruff check ."] --> l3["mypy . --ignore-missing-imports"]
    end
```

Gate semantics worth knowing:

- **`pip-audit` is a supply-chain gate**, not advisory — a CVE in the
  dependency tree fails the build (CLAUDE.md §Dependency Security,
  [ADR-0007](adr/0007-deferred-dependencies.md)).
- **The golden-compliance scan runs before the main test suite** so a
  poisoned/PHI-bearing fixture fails loudly and early.
- **Parity guards run in CI**, not just on dev machines — frontend
  `scenarios_parity.test.ts` in the Vitest job, backend
  `test_schema_parity.py` in the unit job.
- **The live-LLM eval CLI is deliberately not in CI** (needs a provider key,
  costs tokens) — planned as `evals/run_evals.py` (Sprint 4), manual or
  `workflow_dispatch`.
- Playwright E2E is **not** in CI (and currently 10/13 failing — see
  [09-test-architecture.md](09-test-architecture.md)).

## Runtime topology

```mermaid
flowchart LR
    subgraph deployed ["Deployed today"]
        do["DigitalOcean App Platform (region: tor)<br/>static site 'paxos-demo-static'<br/>repo mcruz90/pax-demo, branch demo<br/>deploy_on_push · npm run build → dist/"]
    end

    subgraph local ["Local / dev today"]
        fe2["Vite dev server (SPA)"]
        be["uvicorn main:app — backend/<br/>needs: python 3.12+, uv, tesseract-ocr binary,<br/>.env (API_SECRET_KEY, LLM_BACKEND)"]
        fe2 -- "SSE + Bearer" --> be
    end

    subgraph target ["Target (dashed)"]
        host["Hosted backend"]
        lf["Self-hosted Langfuse"]
        pg2[("PostgreSQL")]
        qd[("Qdrant")]
    end

    be -.-> host
    host -.-> lf & pg2 & qd

    style host stroke-dasharray: 5 5
    style lf stroke-dasharray: 5 5
    style pg2 stroke-dasharray: 5 5
    style qd stroke-dasharray: 5 5
```

Only the **demo SPA** is deployed (`demo` branch, auto-deploy on push,
[ADR-0005](adr/0005-dual-branch-strategy.md)). The backend runs locally; no
hosted backend exists yet. System-level dependency: the Tesseract 5.x binary
(`tesseract-ocr`) for `pytesseract` — installed via apt in CI, must be
present wherever the backend runs.

## Environment matrix

| Environment | `LLM_BACKEND` | Keys needed | Network calls | Purpose |
| --- | --- | --- | --- | --- |
| Local dev | `mock` | `API_SECRET_KEY` only | none | Full pipeline behavior, deterministic letters |
| CI | `mock` (integration tests construct it directly) | none (no secrets in CI) | none | Gates above |
| Live demo / manual eval | `groq` | `API_SECRET_KEY`, `GROQ_API_KEY` | Groq API only | Real generation |
| Deployed SPA | n/a (static) | `VITE_API_KEY` baked at build if pointing at a live backend | optional | Portfolio demo — runs offline on fixtures by default |

Full env-var reference: [06-api-contract.md](06-api-contract.md#environment-variables).

## Deploy-time checklist (when a hosted backend lands)

Collected from in-code flags and CLAUDE.md rules — these are the known
"tighten in production" items:

1. CORS `allow_origins=["*"]` → explicit origin list (`main.py`).
2. Rate limiting (`slowapi`, deferred) once internet-facing.
3. Bearer-token timing side-channel item
   ([backend-security-debt](../backend-security-debt.md) item 3).
4. Langfuse only after re-vetting its network behavior (PHI codebase,
   [ADR-0007](adr/0007-deferred-dependencies.md)); traces best-effort,
   never blocking generation.
5. Durability rule: AuditRecord persisted before the SSE `done` event
   (CLAUDE.md §ACID) — PostgreSQL milestone.
