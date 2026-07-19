# Technical Specification — Prioritization Worklist & Decision Clocks (Unit W1)

This document describes the design and technical specifications for the regulatory deadline worklist prioritizer, configured for the **Operate** persona.

## Goal Description

ClearAuth's prior authorization (PA) and appeal review coordinator workspace requires a deterministic, regulatory-deadline-driven queue. Rather than ordering cases chronologically by creation date, the prioritization engine orders tasks according to remaining hours under state and federal prior authorization laws (e.g., California HSC § 1367.01, Texas Insurance Code § 1369.304, New York Insurance Law § 4903, and CMS-0057-F). 

This design exploration establishes:
1. **Decision Clocks Worklist UI**: A centralized table displaying active cases sorted by the remaining time on their governing regulatory clock.
2. **Four UI States**: Happy path (populated), Empty queue, Loading (skeletons), Sync Error, and Access Denied.
3. **Dual Persona Formatting (Operate vs. Build)**: Shows full PHI for clinicians (Operate) and redacted tokens (`PT-XXXX`) for engineers (Build).
4. **Regulatory Breach Automations**: Specifically, generating "Notice of Deemed Approval" legal documents for cases that exceed New York's 24-hour urgent deadline.

---

## User Review Required

### Key Design Decisions
> [!IMPORTANT]
> **New York Deemed Approval Action**: When a New York regulated plan breaches the 24-hour urgent prior authorization timeline, the request is legally *deemed approved*. The UI displays a primary call-to-action button to **Generate Notice of Deemed Approval**, which automatically structures the legal notice to the plan rather than initiating a standard clinical appeal argument. 

> [!WARNING]
> **ERISA vs. State Regulation**: State prior authorization deadlines (like California HSC or Texas TIC) apply *only* to state-regulated fully insured plans. Self-insured employer plans are subject to federal ERISA guidelines, which permit a longer turnaround (15 days for standard pre-service, 72 hours for urgent). The worklist displays a warning or metadata clarifying which law governs the plan.

---

## Proposed Changes

We are introducing three design artifacts under `docs/design/explorations/decision-clocks/`:
* [NEW] [research.md](file:///C:/Users/maycr/.gemini/antigravity/worktrees/paxos-demo/regulatory-deadline-worklist-design/docs/design/explorations/decision-clocks/research.md) — Labeled registry of federal and state prior authorization timelines.
* [NEW] [mockup.html](file:///C:/Users/maycr/.gemini/antigravity/worktrees/paxos-demo/regulatory-deadline-worklist-design/docs/design/explorations/decision-clocks/mockup.html) — Interactive, dark-mode/light-mode dashboard mockup containing all four states and the persona toggle.
* [NEW] [tech-spec.md](file:///C:/Users/maycr/.gemini/antigravity/worktrees/paxos-demo/regulatory-deadline-worklist-design/docs/design/explorations/decision-clocks/tech-spec.md) — Technical endpoint specification and schema contracts (this file).

---

## API & Data Contracts

### Existing Backend Endpoints vs. Proposed Queue Endpoints

Below is an honest mapping of ClearAuth's existing FastAPI backend endpoints compared to the endpoints proposed for the decision clock worklist:

| HTTP Method | API Path | Existing in Backend? | Description / Implementation Notes |
| :--- | :--- | :--- | :--- |
| **GET** | `/health` | **YES** | Unauthenticated service health check. |
| **POST** | `/api/auth/login` | **YES** | Issues session cookies for the browser. |
| **GET** | `/api/auth/me` | **YES** | Retrieves current session user and claims. |
| **GET** | `/api/reviews/pending` | **YES** | Returns parked exception runs awaiting manual review. |
| **POST** | `/api/appeal/generate` | **YES** | Generates standard appeal letter (SSE stream). |
| **POST** | `/api/appeal/resume` | **YES** | Resumes generation of a parked run. |
| **GET** | `/api/audit/records` | **YES** | Retrieves audit log entries (metadata only). |
| **GET** | `/api/worklist` | **PROPOSED — no backend** | Retrieves the ordered priority queue of cases, including computed decision clock objects. |
| **GET** | `/api/worklist/stats` | **PROPOSED — no backend** | Retrieves summary counts of breached, warning, on-track, and total reviews for the tenant. |
| **POST** | `/api/worklist/{case_id}/deemed-approval` | **PROPOSED — no backend** | Triggers legal notice generation and transmits the document to the payer, logging a `DEEMED_APPROVAL_TRANSMITTED` audit trace. |

### Proposed Data Schema: `DecisionClock`

```json
{
  "case_id": "PA-2026-9051",
  "governing_law_id": "NY-ISC-4903",
  "governing_law_name": "New York Insurance Law § 4903(b)",
  "clock_type": "expedited_pa",
  "statutory_limit_seconds": 86400,
  "elapsed_seconds": 94440,
  "remaining_seconds": -8040,
  "clock_status": "breached",
  "breach_consequence_trigger": "deemed_approved",
  "audit_required": true
}
```

---

## Verification Plan

To verify the mockup and spec:
1. Open the [mockup.html](file:///C:/Users/maycr/.gemini/antigravity/worktrees/paxos-demo/regulatory-deadline-worklist-design/docs/design/explorations/decision-clocks/mockup.html) file directly in any modern browser.
2. Verify visual appearance matching the dark/emerald/violet theme token guidelines of ClearAuth.
3. Test state switches in the header:
   * **Happy Path**: View the sorted list of 4 golden-set cases.
   * **Empty State**: Verify display of the clear-state panel.
   * **Loading**: Verify shimmering skeletons.
   * **Error State**: Verify displaying the sync-error banner and retry action.
   * **Access Denied**: Verify lock panel and request role path.
4. Test persona switches:
   * **Operate**: Displays names (Marcus T. Halverson, Jordan R. Peterman, etc.) and complete PII/PHI.
   * **Build**: Redacts names and details (e.g. `PT-9051 · J.P.`, `[REDACTED BY EHR]`) and shows the Control Plane banner.
5. Click **☀️ Theme** to verify light mode conversion.
