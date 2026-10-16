# ADR-0018: A CRD registry miss is "unknown", and a person decides

- **Status:** Accepted
- **Date:** 2026-10-16
- **Decided by:** May (behaviour decided 2026-10-15; fix-now asked 2026-10-16)

## Context

The initial-PA CRD pre-check (`agents/nodes/crd_check.py`) stands in for the
payer's CRD endpoint with the local `pa_requirements` registry. When neither
the plan_id nor a drug alias matched, it answered `required=False` ("PA not
required") and the pipeline exited early. The node's own docstring called this
failing open. Copilot's PRD slice 4 §5.3 kept it as the registry fallback
("fail-open; flag in audit for manual review").

clearauth-eval's policy-registry gap analysis
(`docs/research/policy-registry-gap-analysis.md`, mcruz90/clearauth-eval #61)
names it as one of two places where ClearAuth guesses when it doesn't know the
policy. A registry miss means "nothing on file", not "the payer requires no
PA": a drug or plan missing from the registry silently skipped the PA.

## Decision

A registry miss gives an **unknown** verdict, and a person decides:

- `PaRequired.required` is `bool | None`. `None` = unknown. `False` is kept
  for a source that actually says no PA is needed (a real payer CRD answer);
  the registry never produces it.
- On unknown, the graph exits before assembly (nothing is submitted, no
  determination); the done event carries `required=None` and a basis that
  starts "Unknown — needs review by a person". The UI shows the same words and
  never "PA not required".
- PRD slice 4 §5.3 is amended accordingly (recorded in
  `docs/design/external-review-triage.md`, since the PRD text is stored
  verbatim).

## Consequences

- No drug × plan reaches "PA not required" by absence of data.
- Wire contract change: `pa_required.required` may be `null` (generated types
  regenerated, ADR-0012). Consumers must treat `null` as "a person decides",
  not as falsy.
- Not yet built: a review-queue entry for unknown CRD verdicts. The review
  queue (ADR-0011) lists parked appeal runs only; the initial-PA graph has no
  checkpointer. Until slice 4's checkpointer (or the policy registry's
  resolver, clearauth-eval plan phase 2 step 4) lands, the person is reached
  through the done event and the result view.
