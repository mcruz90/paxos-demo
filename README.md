# ClearAuth

Prior authorization lifecycle platform for Account Managers — initial PA submissions, determination review, and multi-round appeal generation. The AI handles the structural work; the AM reviews, overrides, and transmits.

> `demo` branch: polished mock-data walkthrough (this repo). `main` branch: live backend build.

## Architecture

```
React Frontend (Vite + Tailwind)
        │
        │  POST /api/appeal/generate  (SSE stream)
        ▼
FastAPI Backend  ──► LangGraph 4-node DAG
        │                   │
        │           [1] Ingestion      validates AppealRequest → PipelineState
        │           [2] Retrieval      loads PA requirements → context block
        │           [3] Synthesis      LLM → streamed appeal letter
        │           [4] Gatekeeper     deterministic rules → pass | retry | error
        │                              (retries up to 3×)
        │
        ├──► LLM Backend  (pluggable — Ollama, Groq, or any OpenAI-compatible endpoint;
        │                  model selection is per-node, not global)
        ├──► Langfuse     (self-hosted; trace + eval scores per run)
        └──► ETL          denial letter → AppealRequest  (Tesseract OCR + PyMuPDF + DSPy)
```

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
| `LLM_BACKEND` | No | `ollama` | `ollama` (local) or `groq` (cloud) |
| `OLLAMA_MODEL` | No | `llama3.1:8b` | Model name |
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama server URL |
| `GROQ_API_KEY` | If `LLM_BACKEND=groq` | — | Groq API key |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model name |
| `LANGFUSE_PUBLIC_KEY` | No | — | Langfuse observability |
| `LANGFUSE_SECRET_KEY` | No | — | Langfuse observability |
| `LANGFUSE_HOST` | No | — | Self-hosted Langfuse URL (required if Langfuse keys set) |

## Running Tests

```bash
cd backend
uv run pytest tests/unit tests/contract      # fast, no LLM
uv run pytest tests/integration              # MockLLMBackend, no network
uv run python -m evals.run_evals --scenario novo-ozempic --tier structural  # live LLM
```

## Roadmap

| Milestone | Status |
|---|---|
| Demo UI — 6 fixture scenarios, full lifecycle UX, eval dashboard, guided tour | ✅ `demo` branch |
| Live backend — LangGraph DAG, FastAPI SSE, HITL overrides, eval harness | ✅ `main` branch |
| Data layer — Qdrant policy store, DSPy EHR extractor, denial letter ETL | In progress |
| Security & compliance — Presidio PHI redaction, PostgreSQL audit log | Planned |
| PA transmission — ePA rails (NCPDP/Da Vinci), payer submissions, determination tracking | Planned |

## Attribution

Appeal letter generation logic forked from
[Fight Health Insurance](https://github.com/fighthealthinsurance/fighthealthinsurance)
— licensed under [Apache 2.0](backend/THIRD_PARTY_LICENSES/Apache-2.0.txt).
See [backend/NOTICE.md](backend/NOTICE.md) for details.
