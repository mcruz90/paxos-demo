# E-01 · Lower dose approved when the PA policy states no limit

A seven-year-old weighing 23 kg has a prescription for esomeprazole oral
suspension, 20 mg once daily for healing erosive esophagitis. In this proposed
edge case the payer approves 10 mg once daily. The PA policy gives no dose or
quantity ceiling. Its extracted Quantity Limits section reads “Not stated.”
The existing pediatric anchor concerns 28 of 56 days at the prescribed 20 mg.
The two cases ask different questions. (`backend/golden/policies/esomeprazole_uhc_pediatric.md:74-84`,
`backend/evals/fixtures/scenarios.json:438`)

The offline anchor timeline (§2) describes 10 mg and 20 mg once daily as label
options at ≥20 kg for ages 1–11 with this indication. Both fit the cited range
at 23 kg. The older copies differ at exactly 20 kg (> versus ≥). **Current label
check pending.** Before quoting a dose or course in a letter, verify the current
prescription label for this formulation and accept its excerpt through the
clearauth-eval A3 runbook (`docs/research/a2-a3-runbook.md:98-115`).
The prescription documents the clinician’s choice. These sources do not establish
that 10 mg is subtherapeutic or that the plan must cover 20 mg.

## Behavior at 63f7cb5

- Intake can classify explicit partial-approval wording. After intake checks,
  it keeps the canonical document, its kind and body hash. It extracts denial
  fields only for a denial. A partial-approval letter therefore yields no
  structured dose comparison. (`backend/etl/denial_letter/document_type.py:114`,
  `backend/etl/denial_letter/document_type.py:257`, `backend/etl/case_intake.py:95-101`)
- The initial-PA determination stub derives approved, pended or denied from
  criterion statuses and pend count. It has no branch for a lower-dose approval.
  (`backend/agents/nodes/determination.py:34-38`, `backend/agents/nodes/determination.py:49-77`)
- The trusted assessment reader binds the case, tenant, patient and revision,
  then supplies the GI and swallowing records. Neither a prescription dose pair
  nor a determination letter reaches the assessment through that reader.
  (`backend/cases/assessment_sources.py:35-46`, `backend/cases/assessment_sources.py:60-70`)
- For the matched pediatric pack, the assessment builds its rows from a fixed
  set of criteria. At age seven, the documented swallowing pathway can yield
  ready with no next action. The 20/10 mg discrepancy generates no finding,
  blocker, appeal or payer inquiry. Readiness describes the evidence for the
  pathway, not an adjudication of either dose. (`backend/cases/pediatric_findings.py:31-42`,
  `backend/cases/assessment.py:37-40`, `backend/cases/assessment.py:85-103`,
  `backend/cases/assessment.py:106-130`)

## Evidence an offline fixture could represent

| Source | What the synthetic fixture would need to show |
|---|---|
| Payer quantity-limit table | A dated row, plan applicability, product, formulation, strength, unit and maximum per time period. One packet per day implies a dose ceiling only if the applicable packet strength and schedule support the conversion. |
| Plan formulary | An entry for the member’s plan, effective on the service date, with product and strength. A quantity-limit flag can point to a separate table. The flag alone supplies no numeric maximum. |
| Determination letter | A dated, case-bound passage identifying the approved strength and schedule, paired with the prescription location for the request. Preserve any cited rule or reason verbatim. A 10 mg approval establishes what the payer decided for this patient. It cannot establish a plan-wide maximum by itself. |

All three can be authored locally as explicitly synthetic, versioned text with
a section or row locator. A fixture can exercise matching, missing sources and
conflicts. Only a verified applicable payer source could substantiate a real
plan limit. Silence in the PA policy leaves that question open.

## Options and acceptance tests for later work

1. **Hold the dose discrepancy for staff review.** Keep initial-PA readiness
   independent. Test 20/10 mg with an absent, expired or wrong-plan table.
   Each should hold the discrepancy, identify the missing evidence and preserve
   readiness on repeat assessment. A documented 20/20 mg match should avoid
   the dose hold, including when the approved duration is shorter.
2. **Show a source-limited finding.** Display “20 mg requested, 10 mg approved;
   limit not in the policy text.” Cite the prescription, letter and reviewed
   policy section separately. Test exact values and locators, a matching table
   with an explicit limit, and a missing or unreadable policy. The last case
   must say the policy could not be checked. A formulary flag alone must never
   produce a numerical cap or a conclusion about clinical adequacy.
3. **Prepare a question for the payer.** Ask staff to confirm which plan rule,
   product strength, units per day and effective date support the 10 mg decision.
   Test that a letter without a source produces a reviewable question, a repeat
   adds no duplicate, and a matching cited rule is shown for reconciliation.
   A conflicting answer should remain open. Generating the question sends nothing.

## Open questions for May

- Should the reviewer see a hold alone, or also the source-limited finding?
- Which plan document should resolve a conflict, and who verifies its applicability?
- Who approves payer outreach and records the response that closes the dose review?

**ASSUMPTION pending May’s decision.** Hold the dose discrepancy for staff
review when the applicable limit is uncertain. Keep the existing PA readiness
calculation and require staff action before any payer contact.
