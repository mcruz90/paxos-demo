# ClearAuth

Prior authorization lifecycle platform for Account Managers — initial PA submissions, determination review, and multi-round appeal generation. The AI handles the structural work; the AM reviews, overrides, and transmits.

> `demo` branch: polished mock-data walkthrough (this repo). `main` branch: live backend build.

## Architecture

```
React Frontend (Vite + Tailwind)
        │
        │  POST /api/appeal/generate  (SSE stream; every stream ends with done|error)
        ▼
FastAPI Backend  ──► 4-node pipeline (interim hand-rolled; LangGraph is the
        │            committed orchestrator — ADR-0001, migration lands with Sprint 2)
        │                   │
        │           [0] Security gate  security_hold requests never reach the LLM
        │           [1] Ingestion      validates AppealRequest → PipelineState
        │           [2] Retrieval      resolves PA pack (plan_id → drug alias → generic;
        │                              resolution path recorded for audit)
        │           [3] Synthesis      LLM → streamed appeal letter
        │           [4] Gatekeeper     deterministic rules → pass | retry | error
        │                              (retries up to 3×)
        │
        ├──► LLM Backend  (provider-neutral: ml.llm_backend.LLMBackend Protocol.
        │                  Implemented today: mock, groq — with timeout, bounded
        │                  retries, circuit breaker. Provider selection is open;
        │                  adding one = one module in ml/ + one factory branch.)
        └──► ETL          denial letter → AppealRequest  (Tesseract OCR + PyMuPDF;
                          sanitization + hidden-text scan set security_hold)
```

Planned (not yet wired): Langfuse tracing (PHI-redacted), DSPy EHR extraction,
Qdrant policy store — see the Roadmap. System structure and settled decisions
live in [docs/architecture/](docs/architecture/README.md).

The demo branch UI runs on 6 built-in fixture scenarios. Connect a local backend for live LLM generation in the POC view.

## Quick Start

**Frontend**
```bash
npm install
npm run dev          # http://localhost:5173
```

Tour and scenario walkthroughs work without a backend. Live appeal generation requires the backend running on port 8000.

**Backend**
```bash
cd backend
cp .env.example .env   # set LLM_BACKEND and credentials
uv sync
uv run uvicorn main:app --reload   # http://localhost:8000
```

Set `VITE_API_KEY` in the frontend `.env` to match `API_SECRET_KEY`.

## Backend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_SECRET_KEY` | Yes | — | Bearer token for all `/api/*` routes |
| `LLM_BACKEND` | Yes | — (no default) | `mock` (deterministic, no network) or `groq`. The provider decision is deliberately open — unset fails fast listing the options |
| `GROQ_API_KEY` | If `LLM_BACKEND=groq` | — | Groq API key |
| `GROQ_MODEL` | No | `llama3-8b-8192` | Groq model name |
| `LLM_TIMEOUT_SECONDS` | No | `30` | Per-request timeout for remote LLM providers |

(Ollama and Langfuse variables will be documented when those integrations land
— see the Roadmap.)

## Running Tests

```bash
cd backend
uv run pytest tests/unit tests/contract      # fast, no LLM
uv run pytest tests/integration              # MockLLMBackend, no network
npm test                                     # frontend vitest (from repo root)
```

A live-LLM eval CLI (`evals/run_evals.py`) is planned for Sprint 4.

## Roadmap

| Milestone | Status |
|---|---|
| Demo UI — 6 fixture scenarios, full lifecycle UX, eval dashboard, guided tour | ✅ `demo` branch |
| Live backend — 4-node pipeline, FastAPI SSE, HITL overrides, eval harness | ✅ `main` branch |
| Data layer — Qdrant policy store, DSPy EHR extractor, denial letter ETL | In progress |
| Security & compliance — Presidio PHI redaction, PostgreSQL audit log | Planned |
| PA transmission — ePA rails (NCPDP/Da Vinci), payer submissions, determination tracking | Planned |

## Attribution

Appeal letter generation logic forked from
[Fight Health Insurance](https://github.com/fighthealthinsurance/fighthealthinsurance)
— licensed under [Apache 2.0](backend/THIRD_PARTY_LICENSES/Apache-2.0.txt).
See [backend/NOTICE.md](backend/NOTICE.md) for details.
