# Letter Workspace — Technical Design Spec (Sprint 4 Unit O12 + O3 + O5)

Companion to the interactive [mockup.html](mockup.html).

This document outlines the frontend design, interaction registry, data contracts, and integration plan for the Unified Letter Workspace in ClearAuth. The workspace merges a pre-synthesis **Policy Gate**, a **Streaming Canvas** with quiet gatekeeper corrections, and a **Verify/Sign-Off Mode** into a single coordinate layout.

---

## 1. Design & Product Thesis

Reviewing and transmitting prior authorization appeals is a high-cognitive-load clinical task. The design of the Letter Workspace centers on three core principles:

1. **Verify Before Generating (Shift Left)**: Gaps in clinical data (such as missing attestations or missing lab results) are highlighted *before* the model generates the appeal. Blocking synthesis until gaps are explicitly resolved prevents the LLM from inventing placeholder values or hallucinations.
2. **Deterministic Governance over Generative Logic**: The "gatekeeper" is not an analytics panel; it is a strict quality gate. If a claim in the generated letter is uncited or conflicts with EHR values, the user cannot transmit the letter. The UI provides deterministic correction pathways (auto-correct to source values, remove the claim, or park the case) that do not allow the user to type new ungrounded clinical text.
3. **Quiet Resilience**: Background gatekeeper retries are hidden from the main viewport, preventing flickering and mid-generation draft wipes. Clear logs provide auditability for clinical engineers without disrupting the coordinator's flow.
4. **Data Plane Isolation (ADR-0014)**: PHI posture is structural. Operate coordinators see full charts; Build engineers see tokenized identifiers (`PT-XXXX`) and redacted documents. Break-glass access is a time-boxed, audited exception rather than a UI setting.

---

## 2. Mockup Features & Interactions

### (a) Structured Policy Gate (Step 1)
- **Visuals**: A list of criteria cards derived from Cigna Connect 500 PPO requirements for Ozempic (GLP-1). 
- **Criteria Evaluated**:
  1. *Type II Diabetes Mellitus Diagnosis* (Resolved, 98% confidence)
  2. *Age ≥ 18 Years* (Resolved, 99% confidence)
  3. *No Concomitant GLP-1/GIP Agonist* (Resolved, 92% confidence)
  4. *Indication Limited to T2DM Glycemic Control* (**Gap Detected**, 74% confidence due to visit note mentioning BMI 33.2 and weight-loss goals).
- **Interactive Resolution**: The Gap card displays an inline resolver. The coordinator must check "Apply Prescriber Attestation Statement" to clear the gap. 
- **Enforcement**: The **Generate Appeal Draft** button remains disabled until the gap is resolved.

### (b) Streaming Synthesis Canvas (Step 2)
- **Visuals**: When synthesis begins, the workspace transitions to Step 2. Text streams into the editor container. Skeletons represent incomplete paragraphs.
- **Quiet Retries Console**: A miniature log console outputs background pipeline events. 
  - On the first attempt, the gatekeeper detects an uncited claim (`patient has been on metformin since 2018`).
  - Instead of discarding the UI state or displaying an error, the system quietly starts *Attempt 2* using negative constraints to exclude the ungrounded assertion.
  - The final letter finishes streaming, displaying a quiet badge: `Passed Gatekeeper after 2 attempts`.

### (c) Verify & Edit Mode (Step 3)
- **Verify Mode Visuals**: The workspace displays the completed draft appeal with active claims underlined and color-coded.
  - **Emerald Underline (Cited)**: The statement is verified and grounded in a source document span (e.g. consult note or med list). Clicking it shows the exact source and a "Jump to Evidence" button that smooth-scrolls and glows the corresponding span in the EHR panel.
  - **Amber Underline (Value Conflict)**: The draft contains a value (e.g., `BMI 32.8 kg/m²` when source says `33.2 kg/m²`). Clicking it opens a popover showing the conflict. The coordinator can select "Update draft to source value" to automatically substitute the correct value.
  - **Red Underline (Uncited)**: The draft asserts a clinical fact with no grounding records. The popover blocks transmission and requires the coordinator to select "Remove claim from draft" or "Request records (Doc-Gap)" to park the case.
- **Edit Mode (Interactive Correction & Verification)**:
  - **Inline Warnings**: Switching to Edit Mode does not strip the visual context. It maintains claims underlines in a dashed format and injects **non-editable inline warning tags** (e.g. `⚠️ Conflict: Source says '33.2 kg/m²'` or `⛔ Uncited: No source record`) directly into the flow of the text area. This immediately signals to the user *what* needs to be changed.
  - **Mandatory Re-Scan**: Bypassing gatekeeper checks in Edit Mode is disabled. Transmission is blocked. The user must click **Re-Scan with Gatekeeper** after making edits. The system runs a validation check (1.5s delay simulation):
    - If the user corrected the values or removed the uncited claims, the scan succeeds, transitions back to Verify Mode, clears the warning footer, and unlocks the **Transmit Appeal** button (recorded with `provenance: human_approved`).
    - If errors remain, the scan returns to Verify Mode showing the remaining conflict/uncited highlights.
- **Transmit Enforcement**: The **Transmit Appeal** button remains disabled, and the gatekeeper footer renders in a blocked warning state, until all conflicts and uncited claims are resolved.

### (d) Multi-Case Exploration (The Four Paths)
- **Path Selection**: An active **Path** dropdown selector in the top bar allows immediate toggling between any of the 4 golden-set scenarios at any time.
- **Dynamic Re-binding**: Selecting a case dynamically changes the patient context, source EHR documents, Step 1 policy criteria, Step 2 streaming text/logs, and Step 3 Verify mode claim highlights, conflicts, and uncited errors.

---

## 2.1 The Four Clinical Cases (Paths)

The workspace mockup provides high-fidelity interactive paths for all four golden-set cases:

| Case ID / Patient | Drug / Payer | Step 1 Policy Gap | Step 3 Value Conflict | Step 3 Uncited Claim |
| :--- | :--- | :--- | :--- | :--- |
| **ozempic_cigna** <br>Marcus T. Halverson | Ozempic <br>Cigna Connect 500 PPO | **Indication Exclusion**: BMI 33.2 and weight-loss goals documented. <br>*Attestation*: T2DM glycemic control is the primary driver. | **BMI Value**: Draft says `32.8 kg/m²`, EHR records `33.2 kg/m²` in Office Visit Notes. | **HbA1c Improvement**: Draft claims a `1.2% improvement`, but there is no historical baseline in the EHR. |
| **livdelzi_cigna_hepatology** <br>Diane K. Rourke | Livdelzi <br>Cigna Connect 500 PPO | **UDCA Step Therapy**: Ursodiol duration is only 8 months (12 required). <br>*Attestation*: Severe UDCA intolerance (nausea/vomiting). | **MELD Score**: Draft says `MELD 7`, EHR records `MELD 9` in specialist consult. | **Concomitant Therapy**: Draft says patient is taking `Ocaliva concomitantly` (unsupported by policy/EHR). |
| **esomeprazole_uhc_pediatric** <br>Jordan R. Peterman | Nexium Suspension <br>UnitedHealthcare | **PPI Step Therapy & Dysphagia**: Rabeprazole/pantoprazole not trialed. <br>*Attestation*: Patient has dysphagia; preferred agents lack liquid forms. | **Date of Birth**: Draft says DOB `09/22/2018`, EHR records `09/22/2017`. | **Alternative Success**: Draft claims patient `tolerated Aciphex tablets` (contradicts dysphagia). |
| **humira_cigna** <br>Yvonne M. Castellano | Humira <br>Cigna Connect 3000 PPO | **Preferred Biosimilar Switch**: Cigna requires trial of biosimilars. <br>*Attestation*: Cyltezo trial failed (loss of efficacy and injection-site reaction). | **CDAI Flare Score**: Draft says `CDAI 18`, EHR records `CDAI 22` on Cyltezo. | **Concomitant Biologic**: Draft claims patient takes `Enbrel concomitantly` (dual biologics prohibited). |

---

## 3. The 5 Mockup States (Hygiene Rule 5)

| State | Mockup Visualization | Interaction & Recovery |
|---|---|---|
| **Default** (Happy Path) | Initial state starts on Step 1 (Policy Gate) with a yellow Gap. | Selecting the attestation resolves the gap, enables the synthesis CTA, and triggers Step 2 stream to Step 3 verification. |
| **Empty State** | A clean overlay panel states "No Appeal Selected". | Displays a grid of golden-set case profiles (Ozempic/Cigna, Nexium/UHC, Livdelzi/Cigna, Humira/Cigna). Clicking any case card loads that specific clinical workspace path. |
| **Streaming** | Skeletons are visible, text streams word-by-word, and the log console scrolls. | Proceed buttons are disabled. Log console displays real-time pipeline events and retry statistics. |
| **SSE Stream Drop** (Error) | Mid-sentence cut-off in the editor paper. Red/amber banner shows connection drop. | Recovery: The coordinator can click **Save Partial Draft**, which automatically saves the generated text, deactivates the streaming state, enters Edit Mode, and lets the coordinator complete the letter manually. |
| **Permission Denied** | Full shield overlay displaying "Access Restricted". | **Break-Glass Flow**: The user clicks "Request Break-Glass Access", enters a clinical justification and duration, and checks an attestation. Once submitted, the case decrypts, a purple timer chip is shown, and the action is committed to the audit store. |

---

## 4. Technical Endpoint Analysis

The mockup interacts with a combination of existing production endpoints and proposed API contracts.

### Existing Production Endpoints (LIVE)
- `GET /api/auth/me`: Verifies the active user session and session cookies (ADR-0013).
- `POST /api/auth/login`: Issues the session cookie on manual authentication.
- `POST /api/auth/logout`: Clears the cookie and csrf session keys.
- `GET /api/reviews/pending`: Retrieves parked cases waiting for human review (audit-as-queue).
- `GET /api/audit/records`: List of committed audit entries for tracking and analytics.
- `POST /api/appeal/resume`: Resume a parked run with manually edited text (`ResumeAppealRequest`). Saves two records: `as_is` draft and the final signed-off `human_edited` or `human_approved` output.

### Proposed Endpoints & Schema Extensions (PROPOSED — no backend)
1. **Gap Resolution in `AppealRequest`**:
   - *Proposed Extension*: Extend `POST /api/appeal/generate` to accept resolved policy gap mappings.
   - *Payload*:
     ```ts
     interface AppealRequest {
       case_id: string
       selected_scenarios: string[]
       // PROPOSED — Passes inline policy resolutions into LLM context
       gap_resolutions?: Record<string, string> 
     }
     ```
2. **`GET /api/appeal/{case_id}/preflight` (PROPOSED — no backend)**:
   - Evaluates the policy pack rules against the adapter-extracted EHR data and returns resolved/gap dimensions with confidence scores before generation begins.
3. **`POST /api/appeal/park-records` (PROPOSED — no backend)**:
   - Moves the case status to `awaiting_documentation` (O11 / G7 workflow) and generates a fax/outbox request for the clinic.
4. **`GET /api/appeal/{correlation_id}/verification` (PROPOSED — no backend)**:
   - Fetches the active `ClaimVerification[]` array for a given appeal letter draft.

---

## 5. Data Contracts & Typing

### Claim Grounding Verification Schema (Sprint 4 Gatekeeper)
When the gatekeeper evaluates the generated letter, it maps segments of the letter body to the following array of verification objects:

```ts
interface ClaimVerification {
  claim_id: string
  start: number                // Character offset start in generated letter
  end: number                  // Character offset end in generated letter
  status: 'cited' | 'conflict' | 'uncited' | 'removed'
  grounding: GroundingSpan | null
  conflict: ValueConflict | null
}

interface GroundingSpan {
  doc_id: string               // Maps to source document tabs (e.g. 'doc-consult')
  page: string                 // Page number in source document
  start: number                // Grounding text start offset in source document
  end: number                  // Grounding text end offset in source document
  source_label: string         // Display label (e.g. 'Endocrinology Consult · p. 1')
}

interface ValueConflict {
  entity: string               // The conflicting unit (e.g., 'BMI')
  draft_value: string          // Generated value ('32.8 kg/m²')
  source_value: string         // EHR ground truth value ('33.2 kg/m²')
}
```

---

## 6. React Port Implementation Guide

When implementing the Letter Workspace component tree:

1. **Keep Spans Logic Pure**:
   - Do **not** use `dangerouslySetInnerHTML` to render verification highlights. Split the raw letter text into string segments using character offsets from `ClaimVerification[]` and map them to styled `<span class="claim">` React nodes.
2. **Read-Only States in Build Persona**:
   - The UI must strictly follow `docs/architecture/12-phi-data-planes.md` (ADR-0014). The `Build` persona path must not import or hold unmasked patient records in React state.
3. **State Management**:
   - Maintain the active letter text, edits, and resolved gaps in a single parent reducer (`useReducer`) to ensure that modifying/removing claims recalculates the gatekeeper verification counts deterministically.
4. **CSS Tokens**:
   - Use the pre-existing design tokens defined in [style.css](../../../src/style.css). Ensure utility classes for color variables (`--bg`, `--surface`, `--primary`) support standard Tailwind compilation in both dark and light modes.
5. **Interactive Edit Mode Warnings & Re-Scanning**:
   - In Edit Mode, set the outer wrapper to `contentEditable` but set nested inline warning badge elements to `contentEditable={false}`.
   - Force a **Re-Scan** pipeline invocation upon text edits to parse updated character offsets and re-validate claim strings before enabling transmission. Bypassing validation with manual edits is strictly prohibited.
