# ADR-0024: Programmatic Tool Calling (PTC) Boundaries & Best-Practice Split

- **Status:** Accepted
- **Date:** 2026-11-27
- **Decided by:** May (approved 2026-11-27; Best-Practice Split settled 2026-11-27 15:15 EST)

## Context

Batching multi-step filtering, ranking, and aggregation reduces LLM round-trips when scanning 20+ candidate literature records or evaluation metrics. However, executing model-authored Python inside the `paxos-demo` healthcare product backend carries unacceptable risks:

1. **Indirect prompt injection from untrusted literature.** Public PubMed abstracts and guideline snippets retrieved by discovery are untrusted text; mixing model-generated code execution with healthcare workflows violates the Principle of Least Agency.
2. **In-process and child-process escape surfaces.** In-process `exec()`/`eval()`/`compile()` exposes CPython `str.format` / `format_map` object traversal, `.gi_frame` / `.f_globals` introspection, and big-int / CPU DoS; even `-I -S` child processes remain host-OS processes unless constrained by OS sandboxes.
3. **PHI and clinical-decision integrity.** ClearAuth's core invariants (ADR-0003 deterministic gatekeeper, ADR-0014 PHI tokenization boundary, ADR-0018/0019 policy-lookup rules, and `tier_router.py` regulatory routing) must remain static, versioned, tested Python.

## Decision

We adopt the **Best-Practice Split** across `paxos-demo` and `clearauth-eval`:

1. **Static, versioned Python ONLY** for PHI, clinical charts (`backend/etl/ehr_extract/`, `PTC-01`), policy selection (`backend/agents/requirements_lookup.py`, `PTC-03`), `backend/agents/nodes/gatekeeper.py`, and `backend/agents/nodes/tier_router.py`.
2. **Closed typed query tools (ZERO code execution) in `paxos-demo` (`PTC-02`):**
   - `backend/cases/literature_query.py` defines a strict Pydantic `LiteratureQuerySpec` (`extra="forbid"`, bounded strings/lists, injection-syntax rejection, `top_k` `1..10`, `max_excerpt_chars` `50..1000`, `sort_by` enum) and `build_non_phi_query(...)` extracting strictly non-PHI `drug` and `indication_or_icd10` fields (never case notes, patient names, DOBs, member IDs, or chart text).
   - `backend/cases/literature_discovery.py` implements `DiscoveryAdapter` in static Python: fans out over 20+ literature records in one pass, filters/ranks deterministically against `LiteratureQuerySpec`, verifies every returned ID and verbatim character span against real corpus records, and returns `tuple[FullTextSource | MetadataSource, ...]`.
   - The offline fixture corpus in `backend/cases/literature_corpus.json` consists strictly of **synthetic test fixtures** (`SYNTH-LIT-*`, `synthetic: true`, `[SYNTHETIC] ` titles, no real medical societies or fabricated clinical claims); live literature requires an injected read-only client returning verified verbatim excerpts.
   - Zero dynamic `exec()`, `eval()`, `compile()`, or PTC subprocesses exist anywhere in `paxos-demo`.
3. **Subprocess-isolated pure-AST PTC permitted ONLY in local dev evals (`clearauth-eval` `PTC-04`, Decision 0058):**
   - Non-`exec` pure AST tree-walking evaluator inside `python -I -S` (primary wall), with `sys.addaudithook` and Windows Job Object + wall-clock `proc.kill()` as defense-in-depth, strictly excluding held-out data.
   - Container/VM OS isolation (`--network=none`, `--read-only`, `--cap-drop=ALL`) is mandatory before any hosted deployment.

## Consequences

- Easier: `paxos-demo` has zero model-code execution attack surface while still narrowing 20+ literature records to verified top-K citations in one deterministic pass.
- Harder / constrained: Any future `paxos-demo` multi-step query capability must use closed typed schemas rather than arbitrary code execution.
