# ADR-0001: LangGraph is the target orchestrator; the hand-rolled pipeline is interim

- **Status:** Accepted — **executed 2026-07-02** (Sprint 2 Slice 0, branch
  `sprint-2-initial-pa`): `agents/graph.py` is now a
  `StateGraph(PipelineState)`; the pre-migration 425-test suite passed
  unmodified. See [02-backend-architecture.md](../02-backend-architecture.md)
  §Orchestration for the as-built design.
- **Date:** 2026-07-02 (backfilled; decision originally made in project
  planning conversations, then lost — see Context)
- **Decided by:** May

## Context

The appeal pipeline is a 4-node DAG (ingestion → retrieval → synthesis →
gatekeeper). Two implementations were possible:

1. **Hand-rolled async generator** — plain sequential calls plus a retry loop
   (`backend/agents/graph.py` today).
2. **LangGraph `StateGraph`** — declarative nodes/edges, conditional routing,
   checkpointing, human-in-the-loop interrupts.

The repo drifted into ambiguity: the README claimed "LangGraph 4-node DAG,"
the code was hand-rolled, and the hardening pass (chore-11 in
[/docs/project-review-hardening.md](../../project-review-hardening.md))
removed `langgraph` from dependencies as unused — correctly, since nothing
imported it. The original intent (LangGraph as orchestrator) lived only in
chat history, and during Sprint 2 planning a hand-coded DAG was nearly
re-implemented as if no decision existed. This ADR is that decision, written
down.

Relevant forces:

- Today's topology is **linear** with one retry loop; a framework adds no
  behavior the ~70-line hand-rolled loop lacks, and CLAUDE.md's dependency
  discipline says don't carry an unexercised framework in a PHI codebase.
- The **TierRouter** design (tiered HITL: routine / complex / exception —
  the main-build architecture) requires conditional edges, run checkpointing,
  and human-in-the-loop interrupts. Hand-rolling those means reimplementing
  LangGraph badly.
- All nodes are already pure `(state) -> state` functions over the
  `PipelineState` TypedDict — LangGraph's native node shape — so migration
  cost is confined to `graph.py`.

## Decision

**LangGraph is the committed orchestrator for the pipeline.** The current
hand-rolled `agents/graph.py` is an explicitly interim implementation.

Migration trigger: **the first feature that needs conditional routing —
planned as the TierRouter node (Sprint 2/3).** At that point:

> **Update 2026-07-02 (May, confirming this ADR after the hardening pass):**
> LangGraph is the de-facto framework for nodes/agents — state management,
> retries, checkpointing come from the framework, not hand-rolled code. The
> trigger fires at **Sprint 2, not Sprint 3**: the initial-PA lifecycle itself
> is conditional (determination → approved | pended-loop | denied →
> appealHandoff — see [05-state-lifecycle.md](../05-state-lifecycle.md)), so
> building it on the interim loop would violate the "no orchestration features
> on the hand-rolled loop" rule below. Migration is scheduled as **Sprint 2
> Slice 0** in [11-sprint-plan.md](../11-sprint-plan.md), behavior-preserving,
> with the 425-test suite as the safety net.

1. Re-add `langgraph` + `langchain-core` through the CLAUDE.md pre-install
   security check (they are already listed in the deferred block of
   `backend/pyproject.toml` with a pinned CVE floor).
2. Rewrite `graph.py` as `StateGraph(PipelineState)` with `add_node` /
   `add_edge` / conditional edges; keep `run_pipeline`'s public signature and
   SSE event contract unchanged so `main.py` and all tests are untouched.
3. Nodes are not rewritten — they are already the right shape.

Until then, two standing rules:

- **Do not add orchestration features (branching, persistence, interrupts,
  parallel nodes) to the hand-rolled loop.** That work belongs to the
  migration; growing the interim loop re-litigates this decision.
- **Keep every node a pure `(state) -> state` function** (already a CLAUDE.md
  rule) — this is what keeps the migration a rewiring, not a rewrite.

## Consequences

- Sprint planning can assume LangGraph for anything involving routing or HITL
  interrupts; no more re-deciding per sprint.
- The interim loop stays small and boring; complexity pressure becomes the
  migration signal rather than accretion in `graph.py`.
- The README's "LangGraph 4-node DAG" claim becomes *forward-accurate* once
  reworded (deferred docs follow-up) — current wording overstates the
  present; this ADR is the authoritative statement meanwhile.
- We accept a one-time migration cost in `graph.py` plus the dependency-vetting
  pass, in exchange for not carrying an unused framework now.
