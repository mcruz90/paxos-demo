# ADR-0002: Provider-neutral LLM backend behind a Protocol; no default provider

- **Status:** Accepted
- **Date:** 2026-07-02 (backfilled; implemented as hard-8/hard-4 in the
  hardening pass)
- **Decided by:** May

## Context

The first Groq integration was an inline class in `main.py` with no timeout,
no bounded retry, and no short-circuit — violating both the layering rule and
the "External APIs can be down" rule (hard-8 in
[/docs/project-review-hardening.md](../../project-review-hardening.md)).
Separately, the LLM **provider decision is deliberately open**: Groq is one
option, not the chosen one, and baking a default provider into code would
quietly make that decision.

## Decision

- The pipeline codes exclusively against the `LLMBackend` Protocol
  (`backend/ml/llm_backend.py`): `model_name`, `generate(prompt)`,
  `generate_stream(prompt)`.
- Each provider is one module in `ml/` behind that Protocol. Adding a
  provider = one new module + one branch in `main.py`'s `_build_llm_backend()`
  factory — **zero changes to `agents/`** (Strategy pattern).
- **No default provider.** `LLM_BACKEND` must be set explicitly (`mock` or
  `groq` today); unset raises at construction, surfaced to the SSE client as
  an `ErrorEvent`, not a dropped connection.
- Every remote provider carries the resilience trio: explicit request timeout
  (Groq: 30s, `LLM_TIMEOUT_SECONDS`), bounded retries (Groq: 2, SDK
  exponential backoff), and the shared `CircuitBreaker` (3 consecutive
  failures → open, 30s cooldown → probe; open raises `LLMUnavailableError`).
- `MockLLMBackend` is a **production module** (not a test helper): it renders
  a letter from the prompt's `Drug:`/`Diagnosis:` lines so it passes the
  gatekeeper for any scenario (hard-4), enabling CI and local dev with zero
  keys and zero network.

## Consequences

- Swapping/adding providers (Ollama, OpenAI, Anthropic) never touches node or
  graph code; the deferred deps block in `pyproject.toml` plus the CLAUDE.md
  pre-install check gate the actual addition.
- Every environment must set `LLM_BACKEND` — a deliberate friction that keeps
  the provider decision visible.
- Per-node model routing (the demo UI's premise: cheap/deterministic nodes vs
  synthesis-grade models) remains open; when it lands, it extends the factory
  and node config, not the Protocol.
