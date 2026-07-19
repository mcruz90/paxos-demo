# Prior Authorization and Appeals Regulatory Deadlines Research

This document compiles the regulatory prior authorization (PA) and appeal turnaround timelines under federal rules and selected state laws for commercial health plans. These metrics govern the "decision clocks" shown in the ClearAuth Operate worklist design exploration.

## Labeled Regulatory Timeline Registry

| Rule / Law ID | Jurisdiction / Plan Type | Standard PA Turnaround Time | Expedited PA Turnaround Time | Breach Consequence | Primary Source URL & Citation | Confidence Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CMS-0057-F** | Federal: Medicare Advantage, Medicaid Managed Care, CHIP Managed Care, QHP Issuers on FFEs | **7 calendar days** | **72 hours** (3 calendar days) | Annual public disclosure of PA statistics; CMS audits, corrective action plans, and civil monetary penalties. | [Federal Register Vol. 89, No. 27 / Feb 8, 2024 (89 FR 8758)](https://www.federalregister.gov/documents/2024/02/08/2024-00895/medicare-and-medicaid-programs-patient-protection-and-affordable-care-act-advancing-interoperability) | **High**: Codified federal rule with clear compliance deadline of January 1, 2026. |
| **Texas Insurance Code § 1369.304 / § 1301.135** | Texas: Regulated Commercial PPO/HMO Plans | **3 calendar days** (72 hours) for prescription drugs; **3 calendar days** (medical preauth) | **24 hours** for expedited prescription drugs; **72 hours** for urgent medical services | Administrative penalties (fines up to $1,000 per violation), corrective action plans by Texas Department of Insurance (TDI), and eligibility for provider "Gold Card" exemptions. | [Texas Insurance Code Sec. 1369.304 (Prescription Drugs)](https://statutes.capitol.texas.gov/Docs/IN/htm/IN.1369.htm#1369.304) and [Sec. 1301.135 (Preauthorization)](https://statutes.capitol.texas.gov/Docs/IN/htm/IN.1301.htm#1301.135) | **High**: Codified Texas statutes with active Department of Insurance enforcement. |
| **California Health & Safety Code § 1367.01(h)** | California: DMHC-regulated Commercial Plans (HMOs/PPOs) | **5 business days** (not to exceed **7 calendar days**) | **72 hours** | DMHC regulatory enforcement, corrective action plans, administrative fines, and potential "deemed approval" if clinical rationale is omitted. | [California Health and Safety Code Sec. 1367.01](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1367.01&lawCode=HSC) | **High**: California statutory law enforced by the Department of Managed Health Care (DMHC). |
| **New York Insurance Law § 4903(b)** | New York: DFS-regulated Commercial Plans | **3 business days** | **24 hours** | **Deemed Approved**: If the insurer fails to make a determination within the statutory timeline, the request is legally deemed approved. | [New York State Insurance Law Sec. 4903](https://www.nysenate.gov/legislation/laws/ISC/4903) | **High**: Codified New York Insurance Law with the specific "deemed approved" consequence. |

## Researched State-Level Commercial Appeal Turnaround Times

The following table details the turnaround times for internal appeals (conducted by the payer) and external appeals (conducted by an Independent Review Organization / IRO) under state and federal commercial rules:

| Jurisdiction / Rule | Standard Internal Appeal | Expedited Internal Appeal | External Appeal (IRO) Timelines | Primary Source URL & Citation | Confidence Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **California (DMHC)** | **30 calendar days** for plan to resolve standard grievances. | Must be resolved as quickly as the medical condition requires (urgent triage). | **30 calendar days** for standard review; **3 calendar days (72 hours)** for expedited review. | [California DMHC IMR and Complaint Guidelines](https://www.dmhc.ca.gov/FileaComplaint/IndependentMedicalRevieworComplaint.aspx) | **High**: Codified DMHC regulations for managed care plans. |
| **Texas (TDI)** | **30 calendar days** for prospective services; **60 calendar days** for retrospective. | Capped at **72 hours** (completed as quickly as the condition requires). | Resolved within **20 days** (standard) or **3 days (72 hours)** (expedited). | [Texas Administrative Code Title 28, § 19.1711 (Appeals)](https://texreg.sos.state.tx.us/public/readtac$ext.TacPage?sl=R&app=9&p_dir=&p_rloc=&p_tloc=&p_ploc=&pg=1&p_tac=&ti=28&pt=1&ch=19&rl=1711) | **High**: Texas Department of Insurance (TDI) utilization review regulations. |
| **New York (DFS)** | Regulated by the agent's process. Requests for missing info must occur within **15 days**. | **2 business days** (24 hours for inpatient substance use disorder). | **30 calendar days** for standard review; **72 hours** for expedited review. | [New York Insurance Law Sec. 4904 (Appeals)](https://www.nysenate.gov/legislation/laws/ISC/4904) and [Sec. 4914 (External Appeals)](https://www.nysenate.gov/legislation/laws/ISC/4914) | **High**: New York State statutory insurance codes. |
| **Federal ERISA** | **30 calendar days** for pre-service; **60 calendar days** for post-service. | **72 hours** from receipt of request. | Governed by federal ERISA external review standards (similar 4-month filing window). | [29 CFR § 2560.503-1 (Claims Procedure)](https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-G/part-2560/section-2560.503-1) | **High**: Department of Labor (DOL) claims procedure rules for commercial self-insured plans. |

---

## Prior Authorization Clock Pauses and Incomplete Requests

The operational mechanisms for pausing, resetting, or extending decision clocks when clinical documentation is missing vary across regulations:

*   **California HSC § 1367.01(h)**:
    *   *Clock Trigger*: Timelines (72h urgent / 5 business days standard) begin only upon receipt of **"information reasonably necessary"** to make a determination.
    *   *Extensions*: If additional clinical information is required, plans may extend the initial decision window for up to **14 calendar days** to obtain the necessary information, provided the plan documents that the delay will not detrimentally impact the enrollee's health.
    *   *Citation*: [California Health and Safety Code Sec. 1367.01](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1367.01&lawCode=HSC)
*   **Texas Insurance Code & TAC Title 28, § 19.1718**:
    *   *Clock Trigger*: Standard turnaround is **3 business days** from receipt of a *complete* request.
    *   *Pauses/Pends*: If a request is incomplete, the utilization review agent pends the request and notifies the provider of the missing details. Providers typically have **3 business days** to submit the required clinical data, during which the clock is pended. If the documentation is not provided, the request is evaluated based on the available records or denied as incomplete.
    *   *Citation*: [Texas Administrative Code § 19.1718 - Preauthorization](https://texreg.sos.state.tx.us/public/readtac$ext.TacPage?sl=R&app=9&p_dir=&p_rloc=&p_tloc=&p_ploc=&pg=1&p_tac=&ti=28&pt=1&ch=19&rl=1718)
*   **New York Insurance Law § 4903**:
    *   *Clock Trigger*: Standard is **3 business days** from receipt of a complete request; expedited is **24 hours**.
    *   *Pauses*: If the utilization review agent determines a request is incomplete, they must request the missing information. The clock is paused from the date the request is issued until the provider submits the requested information. If the agent fails to respond within the statutory timeline (excluding pended/paused time), the request is **deemed approved**.
    *   *Citation*: [New York State Insurance Law Sec. 4903](https://www.nysenate.gov/legislation/laws/ISC/4903)
*   **CMS-0057-F**:
    *   *Approach*: The rule does not establish a standard "clock pause" mechanism. Instead, it mandates **FHIR-based Prior Authorization APIs** (effective January 1, 2027) such as Coverage Requirements Discovery (CRD) and Documentation Templates and Rules (DTR).
    *   *Automation*: These APIs are intended to automate documentation requirements at the point of care, ensuring requests are complete *before* submission. If a request is incomplete, payers must provide a specific clinical reason for denial rather than pending indefinitely.
    *   *Citation*: [Federal Register Vol. 89, No. 27 / Feb 8, 2024](https://www.federalregister.gov/documents/2024/02/08/2024-00895/medicare-and-medicaid-programs-patient-protection-and-affordable-care-act-advancing-interoperability)

*Note: All designs in the decision-clocks session will strictly utilize the turnaround times defined in this registry. Any clinical values or timelines not explicitly referenced above will use `[PLACEHOLDER — needs research]`.*

