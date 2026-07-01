# Frontend E2E Debt

Identified while verifying `sprint-1-wiring` code-review fixes (2026-07-01).
Pre-existing on the branch — confirmed via `git stash` that it reproduces on
an unmodified checkout, so it predates and is unrelated to the sprint-1
backend/fixture fixes in this session. 10 of ~13 E2E specs currently fail.

---

## 1. `LandingHub` redesign broke every E2E entry point

**File:** `src/components/LandingHub.tsx` vs. `e2e/case.spec.ts`,
`e2e/landing.spec.ts`, `e2e/queue.spec.ts`, `e2e/build.spec.ts`

Every spec's setup calls (or duplicates) a `skipToQueue()` helper that does:
```ts
await page.goto('/')
await page.getByRole('button', { name: /Skip the tour/ }).click()
```

That button no longer exists. The current `LandingHub` renders a "Who are
you?"-style picker as **four** role cards (Build / Operate / Scale /
**Sponsor** — Sponsor is new), each wired to `onStartTour(id)` except the
Sponsor card which calls `onRoleChange('Sponsor')` directly
(`LandingHub.tsx:55-97`), plus a `"90-second overview"` button
(`onStartTour('overview')`, `LandingHub.tsx:107-113`). There is no button that
skips straight to the Case Queue.

`e2e/landing.spec.ts` itself is stale in a second way: it asserts heading text
`"Who are you?"` and exactly three cards (`Evaluating the AI Lead` /
`A prospective client` / `An investor or exec`) — the actual page shows four
cards including the Sponsor one, and no `"Who are you?"` text was found in the
rendered snapshot. So `LandingHub` changed (likely alongside the Sponsor role
added per the platformization/market-dimension work) and no e2e spec was
updated to match.

**Affected tests (fail at the missing button/text):**
- `case.spec.ts` — both `PH-3098` and `PH-3101` (verified — PH-3101 was
  rewritten this session for the doc-gap flow, but still fails at
  `skipToQueue()` before reaching the rewritten assertions)
- `landing.spec.ts` — the sole test
- `queue.spec.ts` — the sole test
- `build.spec.ts` — both tests

**Fix path:** Decide the intended landing→queue flow first (bring back a
direct skip button, or route every spec through a role card + tour-skip).
Then rewrite `skipToQueue()` (used by `case.spec.ts`, `queue.spec.ts`,
`build.spec.ts`) and `landing.spec.ts`'s assertions to match current
`LandingHub` copy/structure (four cards, Sponsor included).

---

## 2. Guided-tour overlay never reports 0 count — `tours.spec.ts` all fail independently

**File:** `e2e/tours.spec.ts:20-24` (`runTourToEnd` helper)

Even if issue #1 is fixed, this is a **separate** bug: `runTourToEnd` clicks
the tour's primary button in a loop, then asserts
`.react-joyride__overlay` reaches `toHaveCount(0)`. All four tour tests
(`Build`, `Operate`, `Scale`, `Overview`) time out at that assertion —
the overlay locator either never clears or resolves to `undefined` count.
This means the guided-tour close/exit flow itself is broken (or the
`react-joyride` DOM structure changed), independent of the landing-page
button removal in #1.

**Fix path:** Manually drive a tour in the browser, inspect the actual DOM
class name(s) `react-joyride` renders at tour end, and compare against what
`runTourToEnd` expects. This needs its own investigation — don't assume it's
the same root cause as #1.

---

## Scope note

This doc only covers what surfaced while verifying an unrelated backend/data
review fix — it is not a full E2E audit. Re-run `npx playwright test` after
addressing #1 and #2 to see whether any further specs (e.g. individual
assertions past the setup step) still fail.
