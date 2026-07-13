# Opus Session Prompts — Implementation Master List

*Handoff artifact (2026-07-12). Paste-ready prompts for future Claude Opus
implementation sessions, covering the implementable units and gaps in
[ui-unit-exploration.md](ui-unit-exploration.md). Gemini sessions explore
design; Opus sessions implement. Each prompt is self-contained: paste the
**Standing Preamble** first, then one task prompt, into a fresh session.*

**How to use**
1. One task prompt per session. Don't stack two — scope creep is how quality
   dies.
2. Always paste the Standing Preamble block first, then the task prompt.
3. After a session reports done: run the gates yourself, skim the diff, and
   for anything non-trivial run `/code-review` in a separate session before
   merging — the implementer never verifies its own work (CLAUDE.md).
4. Sessions whose write surfaces don't overlap (see the table) may run in
   parallel worktrees; otherwise sequential.

---

## Standing Preamble (paste at the top of EVERY session)

```text
You are implementing one scoped task in the ClearAuth repo. Read CLAUDE.md
first and follow it exactly. Before starting, read
docs/architecture/10-roadmap-traceability.md, 11-sprint-plan.md, and the ADR
index (docs/architecture/adr/README.md) — decisions recorded there are
SETTLED; do not re-derive or re-litigate them.

Workflow rules (non-negotiable):
- Create a fresh branch off the base branch named in the task. Commit TDD
  red/green pairs: failing test first (RED commit), then implementation
  (GREEN commit). Commit early and often — if you are 15 minutes in with no
  commit, stop exploring and commit what is green.
- STYLE MANDATE from the project owner: simplest implementation that
  satisfies the contract. No defensive branching for states the calling
  context or contract rules out — reachable failures (error terminals,
  transport drops, invalid external input) MUST be handled; impossible ones
  must not be. No long if/else chains — use lookup maps. Sparse comments:
  only non-obvious constraints, matching existing file density. Reuse before
  creating. ~300-line file cap; split first, never grow a god file.
- Backend gates: uv run pytest -q, ruff check, mypy — all green before every
  commit claim. Frontend gates: npx tsc --noEmit, npx vitest run, npm run
  build. If you change ANY Pydantic model that appears in the OpenAPI schema:
  npm run api:dump && npm run api:types, and commit the regenerated files
  (ADR-0012 freshness guard fails CI otherwise).
- Import shared backend types from models.schemas (the facade), never from
  its submodules. Provider neutrality: code against ml/llm_backend.LLMBackend;
  never assume a specific provider (ADR-0002).
- New dependencies require the CLAUDE.md Dependency Security protocol:
  flag the full package list and STOP for acknowledgment before installing.
  Default to zero new dependencies.
- Structural change ⇒ update the relevant docs/architecture/ file in the
  same branch (and add/amend an ADR if a decision was made).
- Do NOT merge anywhere. Leave the branch for independent review. Final
  report: every commit (hash + message), files changed with line counts,
  exact final test counts, any deviation from the brief and why, anything
  noticed but deliberately not done.
```

---

## Sequencing

| # | Prompt | Base branch | Depends on | Parallel-safe with |
| --- | --- | --- | --- | --- |
| P1 | S4a — eval CLI + dimension scorers | frontend-integration | — | P4, P5 |
| P2 | S4b — blocking claim→citation gatekeeper + resume-path fix | P1's branch | P1 | P4 |
| P3 | S4c — redteam regression + eval-gate promotion doc | P2's branch | P2 | P4 |
| P4 | Live-mode auto-login + session-expiry UX | frontend-integration | — | P1–P3 (disjoint surface) |
| P5 | Prompts API + dynamic prompt loading | frontend-integration | — | P1 only until P2 (both touch agents/) — prefer sequential |
| P6 | Citation workspace frontend (doc viewer + Verify mode) | post-P2 merge | P2 + a settled Gemini design | — |
| P7 | Tenancy model design spike → ADR | any | ADR-0014 acceptance helpful | P1–P5 (docs only) |
| P8 | Statutory decision clocks — research task | any | — | anything (research only) |
| P9 | PHI tokenizer at ETL ingest | post-S4 | ADR-0014 **Accepted** + ETL route decision | — |
| P10 | Counter-offer / multi-round — decision brief | any | — | anything (docs only) |

Decision points that are YOURS, not a session's: accepting ADR-0014;
choosing the live/demo seam (X5) before any new shell is built; the demo
gatekeeper check-#4 labeling (dissolves once P2 lands); every dependency
acknowledgment.

---

## P1 — Sprint 4a: eval CLI + dimension scorers

```text
TASK: Sprint 4 slice A — evals/run_evals.py CLI + dimension scorers.
Base branch: frontend-integration. New branch: sprint-4-eval-suite.

Read docs/architecture/11-sprint-plan.md §Sprint 4 and CLAUDE.md §TDD +
§AI Output Accountability first. Context: backend/evals/ currently has
appeal_evals.py (structural scorers used in-pipeline), fixtures/, and
fixtures_adapter.py. run_evals.py does NOT exist — you are building it.

Scope:
1. Dimension scorers against golden labels. The EvalDimension vocabulary
   already exists (coverage, structure, safety, claim_citation,
   over_caution) — one pure scoring function per dimension, each taking
   typed values (never PipelineState, never a live connection), unit-tested
   RED-first with literal inputs. The claim_citation scorer consumes the
   golden set's GroundingRef claim→span labels.
2. evals/run_evals.py CLI: runs the golden set through the pipeline via the
   LLMBackend seam, provider-parametric (--backend mock|groq|...), emits a
   deterministic evals_report.json (sorted keys, stable ordering — same
   discipline as tools/dump_openapi.py). NEVER wired into CI (sprint-plan
   rule: the CLI is a local/eval tool; CI stays LLM-free).
3. Scorers live in evals/, one responsibility per file; the CLI is
   orchestration only. Zero new dependencies (stdlib argparse/json).
4. Docs: update 11-sprint-plan.md §Sprint 4 progress + 09-test-architecture.md
   (evals layer) in the same branch.

Acceptance: with LLM_BACKEND=mock, run_evals.py completes over all golden
scenarios and writes a report whose per-dimension scores are covered by unit
tests; full backend suite (605+) stays green; ruff/mypy clean.
Out of scope: the blocking gatekeeper (next slice), redteam wiring, any UI.
```

## P2 — Sprint 4b: claim→citation BLOCKING gatekeeper + resume-path fix

```text
TASK: Sprint 4 slice B — claim→citation becomes a blocking gatekeeper check,
and the resume path goes through the gatekeeper.
Base branch: sprint-4-eval-suite (on top of slice A).

Read 11-sprint-plan.md §Sprint 4, ADR-0003 (deterministic gatekeeper),
CLAUDE.md §AI Output Accountability + §Defensive Programming, and
backend/agents/nodes/gatekeeper.py (currently 4 deterministic checks).

Settled rulings:
- The check must be DETERMINISTIC (lookup/set-comparison against the
  passed-in CriterionResult[]/pack citations — the demo frontend's
  mechanism is the design spec; see the gatekeeper handoff note in
  memory/docs). Never a second LLM call asking "is this cited?" (ADR-0003).
- When the gatekeeper corrects/strips an uncited claim and the letter then
  passes, the AuditRecord provenance MUST become gatekeeper_corrected — a
  provenance value the path doesn't update is a field that lies (CLAUDE.md).
- Resume-path fix (2026-07-09 security-review finding): human-edited resumed
  letters currently bypass the gatekeeper but the resume AuditRecord stamps
  gatekeeper_passed=True for a letter the gatekeeper never saw. Route the
  resumed letter through the deterministic gatekeeper before resume_finalize
  and set gatekeeper_passed from the ACTUAL result. Decide-and-document what
  a gatekeeper FAILURE on resume does (recommend: error terminal, run stays
  parked, edits not lost — mirrors the existing double-resume contract).
- Retry semantics for the new check on the generate path follow the existing
  MAX_RETRIES loop; exhausted stays the existing exhausted path.

TDD throughout: a test proving an uncited claim cannot leave the system is
the acceptance test, per the detection-paired-with-enforcement rule. Update
docs 02/05/06 + amend ADR-0003 (or add a new ADR) in the same branch. If any
event/model shape changes: regenerate wire types (npm run api:dump &&
api:types). Note in your report that the DEMO's aspirational check-#4 label
can now be made real — but do NOT touch the demo branch.
```

## P3 — Sprint 4c: redteam regression + eval-gated promotion

```text
TASK: Sprint 4 slice C — adversarial fixtures as a standing regression
suite, and the eval gate documented as the promotion mechanism.
Base branch: the P2 branch.

1. Wire the golden set's adversarial/redteam fixtures (Sprint 0) into a
   pytest-marked standing regression suite (deterministic parts run in CI;
   anything needing a live LLM stays in the CLI path — keep CI LLM-free).
2. Document the eval gate as the promotion mechanism for pack/prompt/
   instruction changes in 11-sprint-plan.md + 09-test-architecture.md: a
   change ships only if run_evals.py shows no dimension regression against
   the golden set. (Mechanism doc + threshold constants; the approval UI is
   a later Build-persona unit — B5 in ui-unit-exploration.md.)
3. Close out §Sprint 4 in the sprint plan and move anything deferred to its
   owning sprint row explicitly.
```

## P4 — Live-mode auto-login + session-expiry UX (gap G6)

```text
TASK: close the live-mode session gaps (small, frontend-only).
Base branch: frontend-integration. New branch: live-session-ux.
Write surface: src/components/poc/live/** ONLY. Read src/lib/api.ts —
me(), login(), logout() already exist; do not modify src/lib.

1. Auto-login: on LiveApp mount, call me() once. 200 → initialize the
   session (the httpOnly cookie is still valid — today a page refresh drops
   a valid session); 401 → show LoginForm as now. Handle exactly these two
   outcomes plus transport failure (show the login form with a retriable
   note) — no other states exist in the contract.
   NOTE: me() must return the csrf token for this to work. If MeResponse
   lacks it, STOP and report — that is a backend change (ADR-0013 surface)
   needing its own decision, not a silent workaround.
2. Session expiry mid-work already routes through onExpire → expired banner;
   verify the resume editor's draft is not lost on re-login (if it is, keep
   the draft in state across the login gate — simplest change that works).
3. TDD for any extracted pure logic; existing 120-test suite + tsc + build
   stay green.
```

## P5 — Prompts API + dynamic prompt loading (unit B5, backend half)

```text
TASK: GET/POST /api/prompts + file-backed prompt store, so instruction
tweaks can be tested against the live pipeline.
Base branch: frontend-integration. New branch: prompts-api.

Read CLAUDE.md (prompt templates rule: prompts live in
third_party/fhi/prompt_templates.py or agents/prompts.py — never inline).

Scope (spec-first, TDD):
1. Pydantic schemas for the prompt resource (models/ package, exported via
   models.schemas; regenerate wire types after).
2. backend/data/prompts.json store: agents/prompts.py loads it if present,
   falls back to the hardcoded defaults. Loading happens once per request
   path via an explicit I/O step, not inside pure functions.
3. GET /api/prompts (list, with source: file|default) and POST /api/prompts
   (validated replace; writes the JSON). Both behind the standard auth
   middleware — cookie sessions get CSRF like every non-GET (ADR-0013).
4. SECURITY (blocking requirements): the POST body is untrusted text that
   will be embedded in LLM prompts — enforce size limits; preserve the
   XML-delimiter discipline for untrusted segments; a prompt edit must NOT
   be able to break the delimiter structure (test this adversarially).
   PHI rule: prompt bodies are config, not case data — but log identifiers
   only, never bodies.
5. Docs: 06-api-contract.md + 02-backend-architecture.md same-branch.
Out of scope: the versioning/eval-gate UI (B5 frontend), auto-promotion.
```

## P6 — Citation workspace frontend (units O1–O3) — AFTER P2 and a settled design

```text
TASK: the document-anchored citation workspace — the S4 frontend.
PRECONDITIONS (do not start without them): P2 merged (claim→citation data
exists on the wire); a chosen Gemini mockup for O1–O3 attached/described;
the X5 seam decision made (which shell this lives in).

Read docs/design/ui-unit-exploration.md (units O1, O2, O3 + Operate stress
tests) and docs/architecture/12-phi-data-planes.md (this is a data-plane
surface: full PHI rendering is correct HERE and only here).

Scope:
1. Document viewer pane rendering the case's source text with claim-anchored
   highlight spans (GroundingRef shape); criteria cards and letter claims
   carry source badges that scroll-and-highlight the span.
2. Letter editor Verify mode: per-claim citation status from the P2
   gatekeeper output; a blocked/uncited claim shows WHY and offers the
   correction path (per the Operate stress test: fixing must not invite
   free-typed new uncited text).
3. Golden-set cases only. Re-skin the mockup's layout onto our researched
   fixtures — do NOT import the mockup's invented clinical universe
   (Margaret Vance/Humira/BCBS) or any uncited clinical claim.
4. Component-per-file under the chosen shell's directory; pure logic
   (span mapping, claim-status derivation) extracted and RED-first tested.
```

## P7 — Tenancy model design spike → ADR (gap G1)

```text
TASK: design (not build) the tenancy / user→patient assignment model.
Deliverable: an ADR (Proposed) + a short addition to 03-domain-model.md.
No production code beyond optional schema sketches in the ADR.

Read ADR-0013 (sessions/user_id exists, no roles), ADR-0014 + doc 12 (the
data plane requires "own patients only"), and ui-unit-exploration.md G1/O9.

Answer in the ADR: tenant → org → user → patient-panel relationships; where
assignment lives pre-DB vs Phase 3 PostgreSQL; how the session gains a role
+ tenant claim; how /api/audit/records and /api/reviews/pending become
tenant-scoped (today they return everything to any authenticated caller —
name this as the enforcement change); what the minimum demo-able slice is.
Present 2–3 options with a recommendation; the user decides. Do not
implement the chosen option in this session.
```

## P8 — Statutory decision clocks — research task (gap G2)

```text
TASK: research (not build) statutory PA decision windows for the golden-set
payer contexts. CLAUDE.md §Domain Research applies in full: WebSearch,
authoritative sources only (CMS final-rule text, state statutes/regs),
citation + confidence level per claim, explicit "no authoritative source
found" where applicable — never a plausible guess.

Deliverable: docs/design/regulatory-clocks.md — for CMS-0057-F (impacted
payer types, standard vs expedited response windows, effective dates) and
2–3 representative states, a table: jurisdiction | payer type | window |
clock-start trigger | source URL | confidence. Close with a half-page
recommendation for how a deadline field would attach to the case model
(shape only — no code). This feeds a future Operate worklist unit; numbers
appear in UI only after this doc exists.
```

## P9 — PHI tokenizer at ETL ingest — GATED

```text
GATE CHECK (stop and report if any fails): ADR-0014 status is Accepted;
an ETL upload route exists or is in this task's approved scope; the token
map storage decision (encrypted store, data-plane-scoped) is settled.

TASK: implement tokenize-at-ingest per ADR-0014.
Read ADR-0014, doc 12 (enforcement table), 07-security-architecture.md.

Scope (TDD, spec-first): identifier tokenizer in etl/ (typed tokens
{{PATIENT_NAME}}, {{DOB}}, {{MRN}}, {{MEMBER_ID}}...); token map stored
separately from case state; rehydration helper used ONLY at letter
finalization; tests proving (a) no raw identifier reaches an LLM prompt
string, (b) rehydrated letters are byte-identical to pre-tokenizer output
on the golden set, (c) control-plane surfaces (/api/audit/records) contain
zero tokens' resolved values. Update doc 12's enforcement table
target→enforced rows and doc 07 in the same branch. redact_phi() stays —
defense in depth, not replaced.
```

## P10 — Counter-offer / multi-round — decision brief (gap G3)

```text
TASK: write a decision brief (no implementation). The TierRouter honors a
counter_offer signal that nothing produces; the demo has Round-2 UI; the
backend has no payer-response ingestion. Read 05-state-lifecycle.md,
tier_router.py, and the demo's Round2 panels.

Deliverable: a 1–2 page options doc — (A) build a stub payer-response rail
(mirror of the PAS stub) so multi-round becomes demo-able end-to-end;
(B) keep Round-2 simulated-only and label it roadmap in the demo;
(C) descope counter_offer from the tier rule until a real payer connector
exists. Costs, honesty implications (capability shown vs real), and a
recommendation. The user picks; a later session implements.
```
