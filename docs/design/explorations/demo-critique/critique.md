# ClearAuth Demo Critique: Friction Points & Trust Gaps (Revised)

This document presents the design critique of the ClearAuth demo. To provide full transparency for third-party review, each section contains the **Original Critique Finding**, the **User Feedback/Comment**, and the **Revised Response & Design Position** outlining how the platform's design adapts to the feedback.

---

## Section 1: Prior Authorization Coordinator (Operate Persona)
*Audience: Clinician/coordinator managing case queues; sees full PHI; triages and authorizes submissions.*

### 1. Hard-Locked Prior Auth Letter Tab
* **Original Critique Finding**: The "Prior Auth Letter" tab is disabled and hard-locked with a padlock icon (`Prior Auth Letter 🔒`) until all criteria checklist items are marked satisfied. For cases with document gaps or exceptions, the tab remains completely inaccessible, preventing coordinators from working on the letter or planning edits in parallel, which restricts flexibility.
* **User Feedback**: *"I'm going to disagree here. Since the prior auth letter is LLM generated, it would make sense that the prior auth letter is disabled until all criteria are met. There's no point creating a prior auth letter if not all criteria met. Even if there's a partially recreated letter, this would very lkely be rejected by the payer for being incomplete by not meeting all criteria."*
* **Revised Response & Design Position**: We accept the user's position. Streaming an incomplete or partially validated letter is clinically unsafe and highly likely to result in immediate payer rejection. The lock is a necessary guardrail. The design friction will be resolved not by unlocking the tab, but by improving UX feedback: replacing the static padlock with a dynamic status indicator explaining *why* it is locked (e.g., "Awaiting 2 checklist resolutions") so the coordinator is guided through the expected linear path rather than encountering a dead-end.
* **Severity**: Low (Downgraded from High)

### 2. Missing Manual Case Intake / Override Ingestion
* **Original Critique Finding**: There is no manual case intake option. The queue is exclusively populated by pre-loaded Epic/FHIR fixture data, leaving the coordinator unable to process physical faxes, mail, or legacy portal notifications that do not flow through the automated integration channel.
* **User Feedback**: *"Agreed."*
* **Revised Response & Design Position**: This remains a critical product gap. A manual intake button will be added to the queue header. This triggers a modal where coordinators can upload a denial letter PDF and manually map key identifiers to start the ingestion pipeline.
* **Severity**: Critical

### 3. Simulated Submission Channel Transparency
* **Original Critique Finding**: Clicking "Submit PA" or "File Appeal" shows a generic progress indicator and claims to transmit via "Da Vinci PAS" or "Payer Portal" without showing real-world connection logs, creating a trust gap regarding whether the request actually reached the payer.
* **User Feedback**: *"Agreed."*
* **Revised Response & Design Position**: The design will be modified to include explicit indicators distinguishing between a simulated sandbox run (e.g. "Demo Mode - Ingress/Egress Mocked") and a live payer integration. When connected to a live sandbox, a real-time transmission log drawer will be available to show X12 278 transaction receipts.
* **Severity**: High

### 4. Local Exception Resolver Disconnected from EHR
* **Original Critique Finding**: Resolving a clinical contradiction (e.g., verifying that Diane Okafor has no hepatic decompensation history) only updates the local case state (which logs a snapshot for the outbound letter). The underlying EHR notes remain conflicted and uncorrected. If another prior authorization is requested for this patient in the future, the coordinator will have to resolve the exact same conflict again.
* **User Feedback**: *"This needs more thought. Accessing an EHR is notoriously hard enough; being able to write back to one will be just as difficult. We'd have to look at what regulations/HIPAA state. Depending on the EHR and health system, this would likely be months and months of the health org's IT and security team approving this."*
* **Revised Response & Design Position**: We agree with the user's compliance and integration warning. Bi-directional write access to hospital EHR systems is an extremely high-barrier integration that triggers long IT security reviews and regulatory approvals. Rather than proposing write-back, the UI will be revised to offer a **"Copy Clinical Justification"** utility. This provides a pre-formatted, compliance-safe clinical note that the coordinator can copy and paste into Epic/Cerner in one click, resolving double-work friction without requiring backend write privileges.
* **Severity**: Low (Downgraded from Medium)

### 5. Automated Streaming Force-Start
* **Original Critique Finding**: The moment the Criteria Checklist is fully satisfied and the user opens the Prior Auth Letter tab, the AI starts streaming the letter text automatically. The coordinator is forced to wait for the entire text to stream before they can click "Edit Letter" to make manual changes.
* **User Feedback**: *"I agree."*
* **Revised Response & Design Position**: The UI will incorporate template selection and tone parameters *prior* to starting the LLM generation stream. Additionally, a "Skip & Edit Template" option will allow coordinators to bypass LLM generation entirely and load a standard pre-formatted letter shell.
* **Severity**: Low

---

## Section 2: Health-System Compliance Officer (Build/Audit Persona)
*Audience: Skeptical auditor, engineer, or compliance manager; checks data privacy (PHI), auditability, and deterministic rules.*

### 1. Unlabeled Simulated Q&A Chat
* **Original Critique Finding**: The console displays an active text input box: "Ask about this evidence." When the user types a question and submits, they receive a static hardcoded reply explaining that free-form Q&A is unbuilt and runs on an offline-simulated rail (unit O6) that is hidden. This creates a trust gap regarding the system's actual real-time capabilities.
* **User Feedback**: *"Fair. The demo UI purposely has hard-coded outputs for presentation purposes and would be wasteful in calling real llms. The live UI will legitimately be connected to an llm and backend in general"*
* **Revised Response & Design Position**: While minimizing live LLM calls during demos is standard practice, the UI must manage user expectations. In Demo mode, this Q&A box will be visibly styled as disabled with a clear notice badge: "Evidence Q&A disabled in Demo Mode — active only on Live Backend." This prevents user confusion while preserving presentation efficiency.
* **Severity**: Medium (Downgraded from High)

### 2. Audit Trail Verifiability Deficit
* **Original Critique Finding**: The backend `/api/audit/records` schema (`AuditRecord`) only tracks operational metadata (duration, token counts, success/failure status, model name). It stores no cryptographic hashes of input or output payloads. If a letter is modified by a coordinator or model output shifts, a compliance officer cannot audit the exact text submitted.
* **User Feedback**: *"Agreed. A separate Auditor View will likely need to be created as well (separate from the Operate/Build views, compliance officers operate outside of the org and the builder)"*
* **Revised Response & Design Position**: We agree. The product architecture will be expanded to define a dedicated **Auditor View** role, separate from clinical (Operate) and engineering (Build) panels. This view will provide external compliance officers with a read-only dashboard showing cryptographic ledger proofs, SHA-256 evidence validation hashes, and patient de-identification compliance reports.
* **Severity**: Critical

### 3. Fragile PHI Redaction Scanning
* **Original Critique Finding**: The de-identification system relies on basic regex patterns that fail to redact names with middle initials (e.g., `John Q. Public` escapes redaction), presenting a direct HIPAA exposure risk to external LLM providers.
* **User Feedback**: 
  - *"I\'m not sure if you can access it, but I believe there\'s a doc that discusses using an offline openmed PHI redaction model (or other NER model) to handle this that has not yet been implemented in the UI"*
  - *"I also realize now that there is only one deterministic check that happens at the end of the pipeline, but now this has me thinking what other security/integrity/failsafes we need to consider and if deterministic checks should fire between each node or within each node"*
* **Revised Response & Design Position**: We reference architectural document **ADR-0014** (PHI visibility planes), which specifies a target hybrid scrub pipeline:
  1. Reversible deterministic tokenization of direct EHR identifiers at ingestion.
  2. An **offline, self-hosted healthcare Named Entity Recognition (NER) model (OpenMed-class)** in a sidecar container to identify residual unstructured name fragments.
  3. A deterministic leak gate at the `LLMBackend` protocol seam to block any outgoing prompt containing raw identifiers.
  
  **Granularity & Placement of Safety Failsafes**: Relying solely on a single end-of-pipeline gatekeeper or the outbound `LLMBackend` seam leaves intermediate node transitions vulnerable to passing unredacted or corrupted data. To enforce a true zero-trust pipeline, we propose that deterministic checks (including PHI leak scans, prompt injection filters, and JSON schema assertions) must be executed **both between nodes** (as edge transitions in LangGraph) and **within each node's execution loop** as input/output assertions. If a check fails at any transition point, the graph execution is halted immediately, and the case is moved to a secure quarantine log.
  
  The critique is updated to note that while the UI currently reflects only the simple regex-based token ledger, the backend design incorporates this multi-layered hybrid scrub model (scheduled for sprint P9b).
* **Severity**: High

### 4. Probabilistic "Deterministic Gatekeeper"
* **Original Critique Finding**: The Gatekeeper is implemented as a natural-language prompt draft (`INSTR_GATEKEEPER`) running on a generative LLM. This introduces probabilistic variance, model drift, and potential jailbreak/injection vulnerabilities into what is claimed to be a deterministic check.
* **User Feedback**: *"This needs further investigation. I believe this WAS supposed to be llm-free and run on deterministic checks."*
* **Revised Response & Design Position**: We reference architectural document **ADR-0003** (Deterministic Gatekeeper), which confirms that the backend production Gatekeeper node is indeed a **pure Python/regex rules-based script** (no LLM calls, ever). The trust gap identified is actually a **UI misrepresentation**: the frontend `instructions.tsx` and the Control Plane mockup display natural-language prompt instructions and edit fields for the Gatekeeper, falsely implying to auditors that this safety boundary runs on an LLM. The UI design will be corrected to display the Gatekeeper as a code-only validator with no editable prompt options.
* **Severity**: High (Shifted focus to UI/Docs Drift)

### 5. No Security Quarantine or Injection Logs
* **Original Critique Finding**: Although the pipeline sets a `security_hold` flag when detection rules trigger, these security events are swallowed as generic pipeline errors. There is no UI visibility or dashboard logging these security events for audit.
* **User Feedback**: *"Agreed."*
* **Revised Response & Design Position**: The new Auditor View will host a security hold quarantine ledger, recording the correlation ID, the specific trigger (e.g. bidi characters, hidden text, injection phrases), and a sanitization trace for compliance auditing.
* **Severity**: Medium

---

## Section 3: First-Time Viewer
*Audience: Evaluating the platform with no context; needs to understand how it works and what is real vs. simulated.*

### 1. Simulated vs. Live Capability Confusion
* **Original Critique Finding**: In Live mode, the main case queue wears a "SIMULATED" chip, while the side rail has a "LIVE" chip. A new viewer cannot tell if the case they are triaging is actually talking to a backend or if the whole application is a static mockup.
* **User Feedback**: *"Fair. This should be more explicit"*
* **Revised Response & Design Position**: We will add a global "Harness Control Status" banner at the very top of the screen when running in Demo/Live mode, clearly outlining what data layers are active. In addition, simulated cases in the queue list will carry a tooltip explaining: *"This case uses cached EHR fixtures and does not invoke active LLM/payer API calls."*
* **Severity**: High

### 2. Guided Tour Cognitive Overload
* **Original Critique Finding**: The tour immediately bombards the user with complex terminology ("Da Vinci CRD", "X12 278", "Preferred Specialty Management policy PSM013") and dense paragraphs, causing the user to click "Skip" without understanding the core flows.
* **User Feedback**: *"Yes, the wording on this needs to be less technical but still uses teminology that a claims coordinator is likely to be familiar with as part of their every day workflow"*
* **Revised Response & Design Position**: The tour script will be revised to replace technical development jargon (e.g. "Ingestion node graph", "JSON schema validation") with standard insurance operations terminology (e.g. "prior authorization checklist", "denial letter parsing", "medical necessity exception").
* **Severity**: Medium

### 3. Ambiguous Role Switcher
* **Original Critique Finding**: Roles are presented as tabs with no introductory context. Clicking "Build" immediately drops the viewer into the "Control Plane" and "Ontology Library" with no explanation of who the "Applied AI Lead" is or why they are configuring schemas.
* **User Feedback**: *"Yes, I agree that this needs work"*
* **Revised Response & Design Position**: Clicking a role tab for the first time will trigger a brief 1-sentence overlay explaining that role's responsibilities (e.g., *"Applied AI Lead view: Author prompts, check failures, and grade model outputs against the eval rubric"*).
* **Severity**: Medium

### 4. No Visual Pipeline Flow Graph
* **Original Critique Finding**: The workflow spec is shown as static text lists of inputs and parameters. The viewer has to manually piece together the architecture in their head.
* **User Feedback**: *"Agreed."*
* **Revised Response & Design Position**: We will add a visual node-graph diagram in the Workflow Spec view mapping the data pipeline, visually illustrating how the EHR intake connects to the final approved letter.
* **Severity**: Medium

### 5. Static, Non-Interactive Scale & Sponsor Surfaces
* **Original Critique Finding**: The "Scale" onboarding wizard is a multi-step form that doesn't save anything, and the "Sponsor" insights display static charts with no drill-downs. They feel like non-functional placeholders rather than a complete demo.
* **User Feedback**: *"Yes, this view is one of the least developed at the moment; Operate and Build are p0 and p1, respectively"*
* **Revised Response & Design Position**: To prevent viewers from feeling like the demo is broken, these lower-priority views (Scale, Sponsor) will be labeled with a "Roadmap Target" badge, explicitly detailing the planned features.
* **Severity**: Low
