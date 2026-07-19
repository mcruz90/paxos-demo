# Specification: ClearAuth Break-Glass PHI Access Flow (Build Persona)

**Version:** 0.1  
**Status:** DRAFT SPECIFICATION (DESIGN ONLY)  
**Author:** Applied AI Lead / Platform Architect  
**Scope:** Control Plane (`docs/design/explorations/break-glass/`)  

---

## 1. Context & Architectural Goal

In ClearAuth, engineers (the **Build** persona) operating the control plane generally do not have clearance to view raw Protected Health Information (PHI). They investigate pipeline failures, analyze failure clusters, and adjust prompt instructions using tokenized references (e.g., `PT-5571`, `PR-8821`) and redacted clinical evidence summaries (e.g., `[REDACTED]`).

However, debugging complex pipeline failures (like the critical `cl-safety` cluster where a safety clearance is erroneously satisfied by inference) occasionally requires the engineer to verify the raw, unredacted clinical narrative to compare EHR payload telemetry with model behavior. 

To bridge this gap while maintaining strict HIPAA compliance, this specification designs the **Break-Glass PHI Access Flow** for the Build persona.

### Core Security Principles (ADR-0013 / ADR-0017)
1. **Friction-as-a-Feature**: Routine override must feel heavier than resolving the issue using redacted datasets. It is not an alternative to standard debugging; it is an escalation.
2. **Immutable Audit Ledger**: Accessing raw PHI writes an un-deletable transaction to the audit trail database, signed with the operator's active session identity.
3. **Time-Boxed Reveal**: Raw PHI decrypted view is temporary. The session is protected by a countdown timer (default 60 seconds) with automated client- and server-side relocking.

---

## 2. Design Tokens & Styling Mapping

The design matches the existing ClearAuth demo tokens and inherits properties from `src/style.css` and `design-preview.html`.

### 2.1 Color Palette
* **Theme**: Dark UI by default with emerald primary highlights and violet/purple accents.
* **Build Persona Accent**: Violet (`bg-violet-500/15 text-violet-300 border border-violet-500/25` for badges, borders, and persona chips).
* **Break-Glass Active Alert**: Amber (`#d97706` / `text-amber-300` / `border-amber-500` / `bg-amber-500/10`).
* **Session Terminated**: Red (`#dc2626` / `text-red-400` / `bg-red-500/10`).

### 2.2 Theme Inversion (Light Mode Compatibility)
To support light mode natively, the mockup implements the exact CSS-variable mapping used in `src/style.css`:
* **Slate Backgrounds**: Inverted (`slate-950` becomes `#f8fafc`, `slate-900` becomes `#f1f5f9`, etc.).
* **Accent Color Override**: Primary emerald remapped to ClearAuth plum/violet (`#4c1d95` / `#3b0764`).
* **Paper Document Card**: Preserves absolute light background (`#ffffff`) and dark slate text (`#0f172a`) to ensure legibility of the clinical text under both light and dark shell modes.

### 2.3 Revealed State Warning Border
When break-glass is active, the Case Inspector panel carries a pulsing warning border (`amber-alert-border`) to signify raw PHI is exposed on the monitor.
```css
@keyframes warning-pulse {
  0%, 100% { border-color: rgba(217, 119, 6, 0.4); box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.2); }
  50% { border-color: rgba(245, 158, 11, 0.9); box-shadow: 0 0 12px 2px rgba(245, 158, 11, 0.4); }
}
```

---

## 3. Detailed Flow & Happy Path States

### State 1: Locked Default State
* **Visuals**: Standard dark UI. Case metadata exhibits tokens (e.g. `PT-5571`, `Dr. PR-8821`, `123XXXXXXX`). The clinical evidence snippet has all PHI scrubbed and replaced with `[REDACTED]` tokens.
* **Control**: A prominent amber **"Break Glass (Request PHI)"** button sits on the Case Inspector header.

### State 2: Justification Modal (Friction Gates)
To unlock the session, the engineer must clear four distinct input friction gates in the request modal:
1. **Reason Category**: A mandatory drop-down selector requiring a categorization (e.g., `ACTIVE_INCIDENT`, `CRITICAL_BUG`, `REGULATORY`).
2. **Justification Text Area**: A free-text field requiring a **minimum of 50 characters** describing exactly why redacted details are insufficient.
3. **Confirmation Phrase Input**: The engineer must type the exact case confirmation string: `CONFIRM BREAK-GLASS FOR <CASE-ID>` (e.g. `CONFIRM BREAK-GLASS FOR PH-5571`).
4. **Ledger Warning Notice**: A clear warning banner highlighting that their identity (`maycr@clearauth.io`) will be permanently bound to this decryption transaction in the immutable ledger.

### State 3: Loading/Streaming State
* **Behavior**: Upon modal submission, the system displays a loading indicator representing the backend committing the cryptographic audit block to the ledger network and generating a single-use session decryption token.

### State 4: Revealed State
* **Visuals**: The UI is wrapped in a thick, pulsing amber border. A global top warning bar flashes: `"WARNING: UNENCRYPTED PHI VISIBLE. ACCESS IS REGISTERED IN THE IMMUTABLE AUDIT LOG."`
* **Exposure**: Redacted tokens inside the text document and metadata fields are replaced with real clinical values, highlighted in amber tint blocks.
* **Countdown**: A visible timer on the header counts down from 60 seconds.

### State 5: Relocked State
* **Behavior**: When the countdown reaches `0` or the user clicks `"Lock Now"`, the client discards the decrypted session state. The header header updates to a red-tinted alert banner: `"Break-Glass Session Relocked: The temporary PHI reveal window has closed."` Case identifiers revert back to their redacted tokens.

---

## 4. Immutable Audit Ledger representation

When a break-glass decryption succeeds, a transaction record is generated and appended to the immutable audit trail. In the mockup, this is represented under the ledger registry panel.

### Ledger Record Schema
```json
{
  "timestamp": "2026-07-19T15:44:12.802Z",
  "operator_identity": "maycr@clearauth.io",
  "client_ip": "192.168.1.144",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "action": "BREAK_GLASS_DECRYPT",
  "target_ref": "PH-5571",
  "reason_category": "CRITICAL_BUG",
  "justification": "EHR medication list has conflicting duration records; need to inspect unredacted Metformin stop dates to verify gatekeeper's safety decision.",
  "exposure_duration_sec": 60,
  "cryptographic_hash": "0x5d9b1a77e8a49c25bbfe88a1012375fa0931215b81a7"
}
```

---

## 5. Existing vs. Proposed API Endpoints

This section catalogs which endpoints in the design exist in the ClearAuth codebase today vs. which are proposed exclusively for the break-glass flow.

| Endpoint | Method | State | Description |
|---|---|---|---|
| `/api/auth/me` | `GET` | **EXISTING** | Resolves user identity (`session_user_id` e.g., `maycr@clearauth.io`). |
| `/api/audit/records` | `GET` | **EXISTING** | Fetches the standard audit log (metadata only, no PHI payloads). |
| `/api/auth/break-glass/request` | `POST` | `PROPOSED — no backend` | Submits the justification block and verifies the operator has the `security:break-glass` role. |
| `/api/auth/break-glass/verify` | `POST` | `PROPOSED — no backend` | Commits the audit record, writes to the ledger, and returns a single-use JWT decryption token. |
| `/api/auth/break-glass/lock` | `POST` | `PROPOSED — no backend` | Expressly revokes the active decryption token (manual relock callback). |

---

## 6. Clinical Dataset Mapping (Golden-Set Cases Only)

In compliance with the golden-set requirements, only these four pre-verified cases are mapped. No patient names, payers, NPIs, or clinical details are invented.

### Case 1: Ozempic / Cigna
* **Case Reference ID**: `PH-5571`
* **Target Drug**: `Ozempic (semaglutide)`
* **Payer Plan**: `Cigna Connect 500 PPO`
* **Redacted State (Default View)**:
  * Patient: `PT-5571` | DOB: `1972-XX-XX` | Address: `[REDACTED], Columbus, OH`
  * Prescriber: `Dr. PR-0177` | NPI: `123XXXXXXX`
  * Chart Extract: `...Metformin trial for [REDACTED] days, stopped on [REDACTED] due to [REDACTED] intolerance...`
* **Revealed State (Unlocked View)**:
  * Patient: `Marcus T. Halverson` | DOB: `1972-03-14` | Address: `4821 Ridgecrest Drive, Columbus, OH 43215`
  * Prescriber: `Dr. Priya Ananthakrishnan, MD` | NPI: `1234567890`
  * Chart Extract: `...Metformin trial for 60 days, stopped on 2026-05-12 due to severe intolerance...`

### Case 2: Livdelzi / Cigna
* **Case Reference ID**: `PH-5567`
* **Target Drug**: `Livdelzi (seladelpar)`
* **Payer Plan**: `Cigna Connect 500 PPO`
* **Redacted State (Default View)**:
  * Patient: `PT-3392` | DOB: `1970-XX-XX` | Address: `[REDACTED], Portland, OR`
  * Prescriber: `Dr. PR-0381` | NPI: `345XXXXXXX`
  * Chart Extract: `...ALP at [REDACTED] U/L on [REDACTED], elevation of [REDACTED] times ULN...`
* **Revealed State (Unlocked View)**:
  * Patient: `Diane K. Rourke` | DOB: `1970-11-07` | Address: `29 Birchwood Court, Portland, OR 97201`
  * Prescriber: `Dr. Samuel Okonkwo, MD` | NPI: `3456789012`
  * Chart Extract: `...ALP at 342 U/L on 2026-06-15, elevation of 2.8 times ULN...`

### Case 3: Nexium-pediatric / UHC
* **Case Reference ID**: `PH-4810`
* **Target Drug**: `Nexium Pediatric (esomeprazole)`
* **Payer Plan**: `UnitedHealthcare Choice Plus`
* **Redacted State (Default View)**:
  * Patient: `PT-0481` | DOB: `2017-XX-XX` | Address: `[REDACTED], Raleigh, NC`
  * Prescriber: `Dr. PR-0244` | NPI: `234XXXXXXX`
  * Chart Extract: `...pediatric course of [REDACTED] mg daily ending on [REDACTED], endoscopy on [REDACTED]...`
* **Revealed State (Unlocked View)**:
  * Patient: `Jordan R. Peterman` | DOB: `2017-09-22` | Address: `112 Maple Terrace Lane, Raleigh, NC 27601`
  * Prescriber: `Dr. Yolanda Ekwueme, MD` | NPI: `2345678901`
  * Chart Extract: `...pediatric course of 20 mg daily ending on 2026-04-18, endoscopy on 2026-04-20...`

### Case 4: Humira / Cigna
* **Case Reference ID**: `PH-6012`
* **Target Drug**: `Humira (adalimumab)`
* **Payer Plan**: `Cigna Connect 3000 PPO [Policy IP0652]`
* **Redacted State (Default View)**:
  * Patient: `PT-7789` | DOB: `1968-XX-XX` | Address: `[REDACTED], Asheville, NC`
  * Prescriber: `Dr. PR-0413` | NPI: `456XXXXXXX`
  * Chart Extract: `...methotrexate of [REDACTED] weeks... leflunomide stopped due to [REDACTED] elevation on [REDACTED]...`
* **Revealed State (Unlocked View)**:
  * Patient: `Yvonne M. Castellano` | DOB: `1968-05-19` | Address: `58 Larkspur Hollow, Asheville, NC 28801`
  * Prescriber: `Dr. Helena Brandt, MD` | NPI: `4567890123`
  * Chart Extract: `...methotrexate of 12 weeks... leflunomide stopped due to alanine aminotransferase (ALT) elevation on 2026-03-10...`
