# PaxOS AM Portal

Prior authorization intelligence platform for Account Managers. The AI processes denial letters overnight; the AM arrives to an inbox of completed work and approves or escalates.

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
        │           [3] Synthesis      fhi/generate_appeal → streamed letter
        │           [4] Gatekeeper     deterministic rules → pass | retry | error
        │
        ├──► LLM Backend  (Ollama local  |  Groq API)
        ├──► Langfuse     (trace + eval scores per run)
        └──► ETL-1        denial letter → AppealRequest  (EasyOCR + PyMuPDF + DSPy)
```

## Quick Start

**Frontend**
```bash
npm install
npm run dev          # http://localhost:5173
```

**Backend**
```bash
cd backend
cp .env.example .env   # fill in LLM_BACKEND and any API keys
uv sync
uv run uvicorn main:app --reload   # http://localhost:8000
```

Both must run simultaneously for the live appeal generation to work.

## Backend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_SECRET_KEY` | Yes | — | Bearer token for all `/api/*` routes |
| `LLM_BACKEND` | No | `ollama` | `ollama` or `groq` |
| `OLLAMA_MODEL` | No | `llama3.1:8b` | Model name for Ollama |
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama server URL |
| `GROQ_API_KEY` | If `LLM_BACKEND=groq` | — | Groq API key |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model name |
| `LANGFUSE_PUBLIC_KEY` | No | — | Langfuse observability (optional) |
| `LANGFUSE_SECRET_KEY` | No | — | Langfuse observability (optional) |
| `LANGFUSE_HOST` | No | `https://cloud.langfuse.com` | Swap to self-hosted in Phase 3 |

`VITE_API_KEY` must also be set in the frontend `.env` to match `API_SECRET_KEY`.

## Running Tests

```bash
cd backend
uv run pytest tests/unit tests/contract      # fast, no LLM
uv run pytest tests/integration              # MockLLMBackend, no network
uv run python -m evals.run_evals --scenario novo-ozempic --tier structural  # live LLM
```

## Attribution

Appeal letter generation logic forked from
[Fight Health Insurance](https://github.com/fighthealthinsurance/fighthealthinsurance)
— licensed under [Apache 2.0](backend/THIRD_PARTY_LICENSES/Apache-2.0.txt).
See [backend/NOTICE.md](backend/NOTICE.md) for details.

## Roadmap

| Phase | Milestones | Status |
|---|---|---|
| Phase 1: Foundation | 1.1 Skeleton, 1.2 Policy Ingest (Qdrant), 1.3 DSPy Extractor, 1.4 Eval Harness | 1.4 ✅ (fixture-based), others deferred |
| Phase 2: Live Integration | 2.1 LangGraph DAG, 2.2 FastAPI + SSE, 2.3 Split-pane review, 2.4 HITL overrides | 2.1 ✅ 2.2 ✅ 2.4 ✅ |
| Phase 3: Security & Compliance | 3.1 Presidio PHI, 3.2 Self-hosted Langfuse, 3.3 Audit log (PostgreSQL), 3.4 Payer RLS | Deferred |
| Phase 4: Appeals Automation | 4.1 Denial loop, 4.2 Payer submission, 4.3 Scale testing | Deferred |
