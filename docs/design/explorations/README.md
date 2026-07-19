# Design explorations — external design-review input

**Provenance.** These explorations were produced in **Gemini design sessions**
on **2026-07-18 / 2026-07-19**, each running in its own sibling worktree.
Session prompts were written by Fable; design adjudications are May's
(recorded 2026-07-19). The artifacts are stored here **verbatim** as
external-review input — mockups, specs, and research are the sessions' own
output and have **not** been edited into project conventions.

## Contents

| Folder | Artifacts | Explores |
| --- | --- | --- |
| `letter-workspace/` | `mockup.html`, `tech-spec.md` | Letter Edit/Verify workspace with per-claim citation status (unit O3, SU slice 2, S4 gatekeeper UI) |
| `break-glass/` | `index.html`, `spec.md` | Break-glass PHI access: friction gates, timed reveal, relock, ledger (unit O13, gap G5) |
| `decision-clocks/` | `mockup.html`, `research.md`, `tech-spec.md` | Statutory decision-clock worklist ordered by governing-law deadline (gap G2) |
| `demo-critique/` | `critique.md`, `mockup.html`, `spec.md` | Adversarial critique of the shipped demo, with May's inline adjudications |

## Read these with the triage record

These artifacts are **verbatim** and carry their own (sometimes incorrect)
claims — e.g. statutory characterizations, cited ADR numbers, and invented
patient identities / clinical values. Corrections, adoption decisions, and the
statute-verification results live in the authoritative decision record:
[`docs/design/external-review-triage.md`](../external-review-triage.md).
The canonical unit/gap registry is
[`docs/design/ui-unit-exploration.md`](../ui-unit-exploration.md).

> Any patient identities or clinical values (BMI/MELD/CDAI figures, drug
> narratives) invented inside these mockups require golden-set vetting per the
> CLAUDE.md domain-research rule **before** they may enter `src/data/scenarios.tsx`.
