# ADR-0003: Deterministic gatekeeper — the generator never grades itself

- **Status:** Accepted
- **Date:** 2026-07-02 (backfilled; principle established at project start,
  codified in CLAUDE.md §Defensive Programming)
- **Decided by:** May

## Context

Every string the LLM produces is untrusted until verified, and the company is
liable for what its AI sends to a payer (CLAUDE.md §AI Output Accountability).
The tempting verification shortcut — a second prompt to the same model asking
"is this okay?" — correlates the verifier's failure modes with the
generator's. A model that hallucinated a claim will happily approve it.

## Decision

Verification is always a **separate, deterministic code path** from
generation:

- The **gatekeeper node** (`backend/agents/nodes/gatekeeper.py`) is pure
  regex/string logic: minimum length (300 chars), drug present, diagnosis
  present, no refusal/AI-identity phrases. No LLM call, ever. It drives the
  retry loop (up to 3 attempts) and blocks output that fails.
- **Structural evals** (`backend/evals/appeal_evals.py`) are likewise pure
  Python — five 0/1 dimensions emitted on the `DoneEvent` for observability;
  they do not gate.
- The principle extends to process: for non-trivial features, an independent
  review pass (`/code-review`) is the verification step — not "the tests I
  just wrote pass."

Model-graded evaluation (LLM-as-judge, RAGAS) is allowed **only** as a
separate scoring layer using a different code path (and ideally a different
model), never as the inline gate that decides whether output ships.

## Consequences

- Gatekeeper checks are cheap, fast, and testable with literal strings — but
  intentionally shallow. Claim-level faithfulness (every clinical claim
  traceable to a chart fact or cited policy) is the golden set's
  `claim_citation` dimension and future scorer work; the deterministic gate
  is the floor, not the ceiling.
- Refusal detection by phrase list will lag new refusal styles; patterns live
  in one place (`_REFUSAL_PATTERNS`) and are extended by test-first additions.
- Any future "smart reviewer" node must be additive to the deterministic
  gate, never a replacement.
