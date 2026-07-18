# ADR-0017: Tenancy and user→patient assignment model

- **Status:** Accepted (2026-07-18 — Q1–Q3 accepted as proposed; Q4 resolved
  same day: the seam lands pre-DB as a discipline seam)
- **Date:** 2026-07-18
- **Decided by:** May

## Context

Nothing in the backend knows *whose* case a case is. `AppealRequest` /
`InitialPaRequest` carry clinical facts; `Session` carries only
`{user_id, csrf_token, expires_at}` ([security/sessions.py](../../backend/security/sessions.py));
`GET /api/audit/records` and `GET /api/reviews/pending` return **every**
record to any authenticated caller. This was fine while the only user was
the demo reviewer; it blocks three committed items:

- **ADR-0014's data plane** — "clinicians see full PHI *for their own
  patients*" is unenforceable with no user→patient relation (this ADR is the
  named prerequisite; gap G1).
- **O9 patient roster / patient-file IA** — shipped in the demo on a
  `patientRef` grouping with no backend counterpart.
- **Minimum necessary** (HIPAA) — per-role *and per-panel* scoping is the
  operative rule, not one permission bit.

## Decision

A four-level model, deliberately minimal (no org hierarchy until a customer
demands one):

```
Tenant (customer org, e.g. a clinic/MSO)
  └─ User (named person; role: coordinator | clinician | admin — data plane;
           ClearAuth staff are Build/Scale-plane users and hold NO tenant)
       └─ Panel assignment (user ↔ patient set, the minimum-necessary unit)
            └─ Patient (tenant-scoped identity; patient_ref is the working id)
```

1. **Every case-bearing object gains `tenant_id` + `patient_ref`** —
   spec-first on the request models and `AuditRecord`. `patient_ref` is the
   tokenized working identifier (`PT-XXXX`, per ADR-0014); the token→identity
   map stays in the separately-stored encrypted table, itself tenant-scoped.
2. **The session gains claims:** `tenant_id`, `role`, and (lazily loaded)
   the user's panel. The Bearer service path carries no tenant — service
   calls are platform-plane and must never return rehydrated PHI anyway.
3. **Scoping is enforced at the query boundary, not in handlers:** the
   audit-store / review-queue read paths take a mandatory `TenancyScope`
   argument (fail-closed: no scope, no rows) so a future endpoint cannot
   forget the filter — the detection-pairs-with-enforcement rule applied to
   read access. `/api/audit/records` and `/api/reviews/pending` become
   tenant-scoped; panel scoping applies to patient-file reads (O9), not to
   the work queue (a coordinator team triages the tenant's whole queue —
   assignment ≠ visibility, gap G4 stays separate).
4. **Break-glass (G5/O13) sits on top:** a panel miss inside one's own
   tenant is the break-glass boundary; a tenant miss is a hard 404 (not
   403 — existence is information).
5. **Staging:** pre-DB, tenancy fields ride the existing in-memory stores
   with a single seeded tenant so the demo/live behavior is unchanged;
   enforcement tests land with the fields. Real multi-tenant data waits for
   the Phase 3 durable store (the panel table is the first thing that
   genuinely needs a DB).

## Open questions (answers recorded 2026-07-18)

1. **Is "panel" per-user or per-team?** Proposal: panel = set of
   `patient_ref`s attached to a *user group*, with single-user groups as the
   degenerate case. — **Accepted by May, 2026-07-18.**
2. **Does `tenant_id` enter the correlation ID / idempotency key?**
   Proposal: no — `case_id:aN` stays; tenant is a column, not part of
   identity, but stamped on every AuditRecord. — **Accepted by May,
   2026-07-18.**
3. **Where does the demo reviewer land?** Proposal: seeded tenant
   `tenant_demo` with one user; every existing flow unchanged. — **Accepted
   by May, 2026-07-18.**
4. **Sequencing:** schema fields + fail-closed scope plumbing could land in
   any sprint (small, testable); actual multi-tenant behavior is Phase 3.
   — **Resolved (May, 2026-07-18): land the seam now, pre-DB**, documented
   as a discipline/type seam (the hard multi-tenant guarantee arrives with
   the durable store). Basis: the seam must predate the S4–S6 read
   endpoints (retrofit is how today's unscoped endpoints happened); at
   Phase 3 only the claim *source* changes (session mint → IdP), a joint
   Phase 3 replaces anyway, while the fields, call sites, policy rules, and
   enforcement tests carry over — the tests become the DB migration's
   acceptance suite.

## Consequences

- Unblocks the ADR-0014 data plane, O9's backend story, and G5 break-glass
  (which needs a user to attribute and a boundary to cross).
- Every existing endpoint test gains a scope fixture; `smoke_tour` and the
  dev console get a seeded tenant.
- Docs 03 (domain model), 06 (API contract), 07 (security) and 12 (planes)
  update on acceptance; roadmap rows G1/G5 re-point here.
- Rejected here (recorded so it isn't re-proposed): per-request tenant
  headers (spoofable, duplicates the session), and putting scoping in route
  handlers (the exact pattern that let an unscoped endpoint ship today).
