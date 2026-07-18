# P10 — Payer Counter-Offer Producer: Decision Brief

*2026-07-18. Discussion artifact for gap G3 / unit O12 in
[ui-unit-exploration.md](ui-unit-exploration.md).*

**DECIDED (May, 2026-07-18): Option B** — the counter-offer producer stays
deliberately unbuilt; O12 remains a fixture-driven simulated unit under the
ADR-0016 manifest, and the async payer-response design folds into the S5
payer-rail work. **Option A is pre-approved as the fallback** if a
driveable end-to-end round-2 simulation becomes necessary — no real payer
responses are expected in this build (real payer involvement would be a new
conversation, not this decision). The options below remain as the analysis
behind that call.

## The gap, precisely

Three surfaces reference a payer counter-offer today; none is fed by a
producer:

1. **TierRouter honors the signal** — `TierSignals.counter_offer: bool`
   routes to the complex tier
   ([tier_router.py:39,68](../../backend/agents/nodes/tier_router.py)), with
   the docstring noting it "has no upstream producer yet." The policy is
   complete; the input is always `False`.
2. **The wire/domain model carries the shape** —
   `ScenarioConfig.payer_counter_offer` (`{date, summary, newDenialReason,
   approvedDose}`) exists in both `models/domain.py` and `types.ts`, fed
   only by fixtures.
3. **The demo UI runs a full round-2 flow** — `PayerCounterOfferBanner`,
   the dispute resolver (evidence packet), `Round2DonePanel`/
   `SubmittedPanel`, all fixture-driven (O12 demo flow shipped 2026-07-17).

CLAUDE.md's detection-pairs-with-enforcement rule is the lens: a signal the
router honors but nothing produces is half a mechanism. Unlike the
`security_hold` case the risk isn't safety (a permanently-false flag can't
misroute), it's honesty — the UI shows a capability whose trigger cannot
occur.

## Why a producer is genuinely hard

A counter-offer arrives **from the payer, asynchronously, after
submission**. Everything the pipeline does today is request-scoped: one POST,
one SSE stream, one terminal, one audit record. A real producer needs an
inbound payer-response channel (webhook, poll, or 278 response rail), a
place to persist "case awaiting payer response" across requests (pre-DB,
today's state dies with the process), and determination parsing —
approved / denied / **partial approval (the counter-offer)**. That's the
same infrastructure the O8 case timeline and G2 decision clocks eventually
want; it should be designed once, not improvised for O12.

## Options

### A — Stub payer-response rail (mirror the PAS stub)

A deterministic inbound rail: `POST /api/payer/response` (service-auth) or a
determination step in the stub PAS adapter that can return
`partial_approval` with a typed `CounterOffer`; wires `TierSignals.
counter_offer` and a `payer_response` case status end-to-end.

- **For:** completes the mechanism honestly (the demo's round-2 flow becomes
  a real, driveable path on mock rails); exercises the async-response shape
  the platform needs anyway; O12 can be promoted `simulated → live` in the
  manifest against the stub.
- **Against:** real backend work (new lifecycle states, persistence
  questions land pre-DB); risks building the async model twice if the real
  payer connector (S5+) contradicts the stub's guesses.

### B — Label as roadmap (manifest-honest, no backend)

Keep the demo flow, mark O12 `simulated` in the capability manifest
permanently-until-built; the ADR-0016 chip is the honesty mechanism. Add a
sentence to the TierRouter docstring and the roadmap row naming the producer
as deliberately unbuilt.

- **For:** zero cost now; ADR-0016 just gave us the vocabulary for exactly
  this state; the design question folds into the S5 payer-connector work
  where the real answer lives.
- **Against:** the round-2 story stays undemonstrable end-to-end; the
  half-mechanism persists (mitigated by it being inert, documented, and
  chip-labeled).

### C — Descope round 2

Remove the demo's counter-offer/round-2 panels and the unused signal until
a payer rail exists.

- **For:** no fiction at all.
- **Against:** destroys real design work that is the *spec* for the future
  flow (the exploration map's "the mockup IS the spec" principle); the
  TierRouter policy would lose a case the regulation-driven rule already
  anticipates. Descoping buys nothing Option B doesn't.

## Prepared recommendation

**B now, A's design folded into the S5 payer-rail ADR.** Post-ADR-0016 the
simulated chip makes B honest by construction, and the async payer-response
model deserves to be designed against a real connector shape, not invented
for a demo unit. If a pilot needs a demonstrable round-2 flow sooner, A is
the fallback and should reuse the PAS-stub adapter pattern (deterministic
`submission_ref`-keyed responses).

**May's call. Nothing is built from this brief.**
