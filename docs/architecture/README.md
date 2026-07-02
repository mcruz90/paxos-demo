# ClearAuth Architecture Documentation

The formal blueprint for the ClearAuth / PaxOS system. These documents are the
single place where the *structure* of the system is recorded — what the pieces
are, how they connect, which decisions are settled, and where the build is
heading. CLAUDE.md remains the home for *rules* (how we write code); this
directory is the home for *shape* (what the system is).

**If you are planning a sprint or changing system structure, start here — in
particular [10-roadmap-traceability.md](10-roadmap-traceability.md) and the
[ADR log](adr/README.md).** The direct trigger for this suite: during Sprint 2
planning, a hand-rolled DAG was nearly re-implemented because the LangGraph
orchestration decision lived only in chat history. That decision is now
[ADR-0001](adr/0001-langgraph-target-orchestrator.md).

## Reading order

| Doc | What it covers |
| --- | --- |
| [01-system-overview.md](01-system-overview.md) | C4 context + container view: actors, frontend/backend split, external systems, dual-branch strategy |
| [02-backend-architecture.md](02-backend-architecture.md) | Backend layers, the 4-node pipeline, orchestration status (interim hand-rolled vs LangGraph target), patterns in force |
| [03-domain-model.md](03-domain-model.md) | Entity diagrams for all Pydantic schemas, enums, frontend parity contract, domain glossary |
| [04-data-flow.md](04-data-flow.md) | End-to-end data flows with trust boundaries: appeal generation and the golden-set/fixtures supply chain |
| [05-state-lifecycle.md](05-state-lifecycle.md) | State machines: CaseStatus, CaseLifecycle, pipeline execution states, frontend SimPhase |
| [06-api-contract.md](06-api-contract.md) | HTTP + SSE contract: routes, auth, event shapes, error semantics, environment variables |
| [07-security-architecture.md](07-security-architecture.md) | PHI boundary, sanitization/redaction interception points, threat table |
| [08-deployment-ci.md](08-deployment-ci.md) | CI jobs and gates, runtime topology, environment matrix |
| [09-test-architecture.md](09-test-architecture.md) | Test tiers, TDD workflow, eval layer, known test debt |
| [10-roadmap-traceability.md](10-roadmap-traceability.md) | Target architecture and the roadmap → component → ADR traceability map |
| [adr/](adr/README.md) | Architecture Decision Records — the settled (and rejected) decisions |

## Relationship to other documents

These docs deliberately do **not** duplicate content that already has an
authoritative home. Link targets:

| Document | Authoritative for |
| --- | --- |
| [/CLAUDE.md](../../CLAUDE.md) | Development standards: TDD, file organization, DRY, defensive programming, security defaults, dependency vetting, collaboration norms |
| [/docs/golden-set-governance.md](../golden-set-governance.md) | Golden-set data classification, sourcing, provenance |
| [/docs/project-review-hardening.md](../project-review-hardening.md) | The 2026-07-02 hardening pass — 14 items (`hard-1` … `docs-14`) referenced throughout these docs |
| [/docs/backend-security-debt.md](../backend-security-debt.md) | Pre-hardening security debt inventory |
| [/docs/frontend-e2e-debt.md](../frontend-e2e-debt.md) | Known Playwright E2E failures (landing-hub redesign) |
| [/README.md](../../README.md) | Product overview and quick start |

## Conventions

- **Diagrams are Mermaid** inside markdown — renderable on GitHub and in VS
  Code preview, diffable in review, no tooling to install.
- **As-is vs target is always explicit.** Planned components appear in
  sections labeled "Target" and as dashed/annotated nodes in diagrams. If a
  diagram doesn't say "target", it describes the code as it exists today.
- **Facts are sourced from code.** Every file path, field name, constant, and
  event shape in these docs was verified against source at the date in each
  doc's header. If a doc and the code disagree, the code is right and the doc
  needs a PR.

## Keeping these current

A structural change (new node, new layer, new external dependency, changed
event contract, changed lifecycle) should update the relevant doc — and add or
amend an ADR if a decision was made — in the same PR as the code change.

> **Pending:** the enforcing rule in CLAUDE.md is deferred until the
> `project-review-hardening` branch lands (that file was in active edit when
> this suite was written, 2026-07-02). Until then, this section is the rule.
