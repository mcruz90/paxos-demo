# Design Specification: Case Review & Ingestion Workspace

This specification defines the interactive workspace mockup (`mockup.html`) designed to address the friction points and trust gaps identified in the ClearAuth critique.

---

## 1. Persona Configuration

The workspace top-bar allows toggling between two primary personas, altering the rendering of Protected Health Information (PHI) in accordance with roles.

### 1.1 Operate Persona (PA Coordinator)
* **Goal**: Validate clinical criteria check results and authorize payer transmissions.
* **PHI Visibility**: Full name, Date of Birth (DOB), and unredacted clinical documentation.
* **UI Ingestion Mapping**: Displays real-name identifiers (e.g., `Margaret Vance`, `Lucas Rivera`) and actual dates.

### 1.2 Build Persona (Applied AI Lead / Compliance Officer)
* **Goal**: Govern prompt instructions, review model failure rates, and audit logs.
* **PHI Visibility**: Redacted. All names replaced with `PT-XXXX` tokens, and DOB fields replaced with `[REDACTED]`.
* **UI Ingestion Mapping**: Automatically maps name records (e.g., `Margaret Vance` to `PT-3102`, `Lucas Rivera` to `PT-4201`) in the case queue list, review header, checklist note text, source citations, and generated letter drafts.

---

## 2. Four UI States (plus Happy Path)

The mockup represents five discrete workspace states:

### 2.1 Happy Path
* **Description**: A case is actively selected, criteria checklist is reviewed, and the generated letter draft is fully loaded and ready for review/editing.
* **Actions**: Coordinator can apply overrides, edit the text draft, and click "Submit Prior Authorization."

### 2.2 Empty State
* **Description**: No case is selected. The middle pane displays a placeholder screen prompting the coordinator to select a case from the queue sidebar or trigger a manual case intake.
* **Friction Addressed**: Prevents displaying a random case on load, ensuring a clean work queue start.

### 2.3 Loading/Streaming State
* **Description**: Simulates the execution of the ingestion and retrieval pipeline. Displays an animated loading progress bar indicating the active execution of pipeline nodes (Ingestion → Retrieval → Synthesis → Gatekeeper).
* **Friction Addressed**: Provides transparency regarding the asynchronous processing of documents, indicating exactly which agent node is executing.

### 2.4 Error State
* **Description**: Simulates an API execution timeout or JSON validation exception (`ETLParseError`) during document ingestion. Displays a structured error window with:
  1. An error description and the implicated endpoint.
  2. A scrollable terminal console outputting the raw traceback logs.
  3. A prominent "Retry Pipeline Run" recovery button.
* **Friction Addressed**: Replaces raw application crashes or hidden connection failures with a clean remediation path.

### 2.5 Permission-Denied State (403 Forbidden)
* **Description**: Simulates a security check where the session user lacks the required OAuth scopes (`phi:view_unredacted` or `policy:override`).
* **UI Elements**: Displays a locked warning card outlining missing credentials and provides a "Request Break-Glass Access" bypass button.
* **Friction Addressed**: Clearly informs the user why an action is blocked rather than silently disabling buttons.

---

## 3. Researched Clinical Content Grounding

All data utilized on screen corresponds strictly to the researched golden-set cases:

### 3.1 Case 1: Ozempic (semaglutide) / Cigna Connect 500 PPO
* **Case Reference**: `PH-3102` (Margaret Vance) | **DOB**: `03/14/1972`
* **Policy ID**: `CIGNA-CNF360-2024` (cnf_360)
* **Diagnosis**: Type 2 Diabetes Mellitus (E11.9)
* **Friction Focus**: Metformin step therapy and indication review. A BMI note of `33.2` triggers a "Needs Review" exception for weight-loss exclusion.

### 3.2 Case 2: Livdelzi (seladelpar) / Cigna Healthcare PPO
* **Case Reference**: `PH-2847` (Diane Okafor) | **DOB**: `09/01/1959`
* **Policy ID**: `CIGNA-CNF877-2024` (cnf_877)
* **Diagnosis**: Primary Biliary Cholangitis (PBC) - K74.3
* **Friction Focus**: Decompensation history conflict. Consult notes "no decompensation" but discharge notes document "ascites episode." Surfaces both sources in the resolver modal for manual reconciliation.

### 3.3 Case 3: Nexium (esomeprazole suspension) / UnitedHealthcare Choice Plus
* **Case Reference**: `PH-4201` (Lucas Rivera) | **DOB**: `05/30/2019`
* **Policy ID**: `UHC-CHOICE-2024`
* **Diagnosis**: Pediatric GERD with Erosive Esophagitis (K21.0)
* **Friction Focus**: Oral-motor dysphagia bypasses tablet step therapy. Payer response grants the step therapy exception but limits the dose to `10mg/day`. The coordinator must appeal to request the full therapeutic dose of `20mg/day` indicated for patients weighing `[PLACEHOLDER — needs research]` kg (>=20kg).

### 3.4 Case 4: Humira (adalimumab) / Cigna Connect 3000 PPO
* **Case Reference**: `PH-5177` (Yvonne M. Castellano) | **DOB**: `05/19/1968`
* **Policy ID**: `CIGNA-IP0652-2026` (IP0652)
* **Diagnosis**: Rheumatoid Arthritis (M05.79)
* **Friction Focus**: Non-preferred brand Humira. Requires Cyltezo biosimilar trial. Records confirm Cyltezo trial and failure (severe site reactions and loss of disease control), triggering a medical necessity exception request under PSM013.

---

## 4. Backend API Endpoint Mappings

This section details the mapping of interface features to the backend API layer, categorizing endpoints as existing in the current codebase vs. proposed.

### 4.1 Existing APIs (Defined in openapi.json)

#### 1. Case Retrieval
* **Route**: `GET /api/reviews/pending`
* **Purpose**: Fetches the queue of prior authorizations requiring review.
* **Payload**: `PendingReviewsResponse` carrying metadata and status fields.

#### 2. Appeal Generation
* **Route**: `POST /api/appeal/generate`
* **Purpose**: Initiates the synthesis pipeline to draft the appeal letter text.
* **Payload**: `AppealRequest` (POST) → Streams SSE frames containing chunked draft text.

#### 3. Save Edits and Resume
* **Route**: `POST /api/appeal/resume`
* **Purpose**: Saves coordinator edits to a letter draft and moves the case status forward.
* **Payload**: `ResumeAppealRequest` (POST) → Streams SSE confirmation event.

#### 4. Submit Prior Authorization
* **Route**: `POST /api/pa/submit`
* **Purpose**: Submits a finalized PA request bundle (questionnaire and FHIR X12 payload) to the payer.
* **Payload**: `InitialPaRequest` (POST) → Streams SSE confirmation event.

#### 5. Audit Trail Logs
* **Route**: `GET /api/audit/records`
* **Purpose**: Populates the audit explorer panel with transaction records.
* **Payload**: `AuditRecordsResponse` containing completion metrics and hashes.

---

### 4.2 Proposed APIs (PROPOSED — no backend)

The following endpoints are design-level proposals to address key coordinator and compliance officer trust gaps.

#### 1. Manual Case Intake
* **Route**: `POST /api/intake/manual`
* **Status**: **PROPOSED — no backend**
* **Purpose**: Allows coordinators to upload a PDF denial letter or type patient clinical records manually when automated FHIR ingestion fails.
* **Payload**:
  ```json
  {
    "patient_id": "PT-XXXX",
    "document_type": "denial_letter_pdf",
    "raw_file_bytes": "string_base64"
  }
  ```

#### 2. Evidence Q&A Discovery
* **Route**: `POST /api/discovery/qa`
* **Status**: **PROPOSED — no backend** (Currently stubbed in the UI as a static notice referring to unit O6)
* **Purpose**: Powers the Q&A input in the Evidence Discovery Console, allowing real-time semantic search over clinical guidelines and the patient's EHR records.
* **Payload**:
  ```json
  {
    "correlation_id": "string",
    "query": "string"
  }
  ```

#### 3. Clinical Note Export (EHR Helper)
* **Route**: Local Clipboard Copy / Export UI Action (Alternative to raw writeback)
* **Status**: **PROPOSED — UI Utility**
* **Purpose**: Rather than direct bidirectional writeback (which triggers complex IT security and HIPAA reviews), the system exports resolved justifications as standardized Epic-compatible clinical notes that coordinators copy/paste in one click to reconcile EHR discrepancies.
* **Payload**:
  ```json
  {
    "patient_id": "PT-XXXX",
    "resolved_criterion": "string",
    "formatted_clinical_note": "string"
  }
  ```
