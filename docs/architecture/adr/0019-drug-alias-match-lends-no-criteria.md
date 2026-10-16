# ADR-0019: A drug-name match lends no criteria; the case goes to a person

- **Status:** Accepted
- **Date:** 2026-10-16
- **Decided by:** May (behaviour decided 2026-10-15; fix-now asked 2026-10-16)

## Context

`agents/requirements_lookup.resolve_requirements` resolved PA criteria by exact
`plan_id`, then by a drug-alias substring, then by a generic text. When the
plan_id wasn't a pack, the first pack whose alias appeared in the drug name
supplied **its** criteria: a UnitedHealthcare request for Ozempic got Cigna's
CNF 360 criteria. Downstream:

- the appeal tier router sent `drug_alias` to `complex`, not to a person, so a
  letter could argue another payer's policy with only a closer read;
- the CRD pre-check read `drug_alias` as "PA required", so the initial-PA run
  assembled and submitted a PA built on another plan's criteria.

clearauth-eval's policy-registry gap analysis
(`docs/research/policy-registry-gap-analysis.md`, mcruz90/clearauth-eval #61)
names this as the second place ClearAuth guesses when it doesn't know the
policy. The agreed rule: when the variant is unknown, a person decides.

## Decision

A drug-alias match is recorded but lends nothing:

- `resolve_requirements` returns the generic text with resolution
  `"drug_alias"`, never another plan's `criteria_text`. Only a `plan_id` hit
  supplies payer criteria. The alias index is now a set, not a map to
  criteria, so the borrow can't come back by accident.
- The tier router treats `drug_alias` like `generic`: **exception** (a person
  reviews before anything leaves).
- The CRD pre-check treats `drug_alias` like a miss: **unknown**
  (`required=None`, ADR-0018), so nothing is submitted.
- The appeal done panel says "No policy on file for this plan — another plan's
  criteria not used; needs a person", never "Policy match drug_alias".

`"drug_alias"` stays in `PaResolution`: it tells the reviewer the drug is known
under another plan, which is useful when they look the policy up.

## Consequences

- No letter or PA submission uses another plan's criteria.
- More cases reach a person: every request whose plan isn't a pack. Today all
  scenario fixtures resolve by `plan_id`, so none change.
- Not covered here: an exact `plan_id` hit still returns that pack's criteria
  whatever the drug (a plan_id is really one drug policy). That is a separate
  behaviour change.
- The policy registry's resolver (clearauth-eval plan phase 2 step 4) replaces
  this lookup; it keeps the same rule.
