# ADR-0007: Dependencies stay out of the tree until something imports them

- **Status:** Accepted
- **Date:** 2026-07-02 (backfilled; implemented as chore-11 in the hardening
  pass)
- **Decided by:** May

## Context

By the hardening review, `pyproject.toml` carried five packages nothing
imported (`dspy`, `sentence-transformers`, `qdrant-client`, `langgraph` +
`langchain-core`, `langfuse`, plus `slowapi` and `pydantic-settings`) —
installed "for later." In a PHI-handling codebase every installed package is
supply-chain attack surface (the 2026 LiteLLM incident, CVE-2026-40217, is
the canonical example: an official package exfiltrating API keys), and
`pip-audit` noise from unused trees erodes the CI gate's signal.

## Decision

- A package appears in `[dependencies]` **only while first-party code
  imports it.** Roadmap-intended packages live as a commented **deferred
  block** in `backend/pyproject.toml`, with their milestone and any known
  CVE floor pinned in the comment (e.g. `langchain-core>=1.3.3` for
  CVE-2026-44843).
- Re-adding a deferred package goes through the full CLAUDE.md
  §Dependency Security pre-install protocol (flag to user, supply-chain
  search, typosquat check, post-install audit) — deferral does not
  pre-approve it.
- Telemetry/observability packages (`langfuse` etc.) additionally require
  verifying exactly what network calls they make on import and at runtime
  before entering this codebase.
- The exception that proves the rule: `loguru` stays because forked
  `third_party/fhi/` code imports it, noted inline.

## Consequences

- `uv.lock` and the pip-audit surface stay minimal; a CVE finding in CI is
  actionable, not noise.
- Sprint work that needs a deferred package pays a vetting step at the start
  — [10-roadmap-traceability.md](../10-roadmap-traceability.md) carries the
  re-entry checklist so it's planned, not a surprise.
- The deferred block doubles as a roadmap breadcrumb: what we intend to use,
  and for which milestone, without carrying the risk yet.
