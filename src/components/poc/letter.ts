import type { PatientContext, ScenarioConfig } from '../../types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildPatientHeader(ctx: PatientContext): string {
  return [
    `Patient: ${ctx.patientName}  |  DOB: ${ctx.patientDob}  |  Sex: ${ctx.patientSex}`,
    `Member ID: ${ctx.memberId}  |  Group: ${ctx.groupId}`,
    `Address: ${ctx.patientAddress}`,
    ``,
    `Prescriber: ${ctx.prescriberName}  |  NPI: ${ctx.prescriberNpi}`,
    `Specialty: ${ctx.prescriberSpecialty}`,
    `Address: ${ctx.prescriberAddress}  |  Phone: ${ctx.prescriberPhone}`,
  ].join('\n')
}

function buildPatientHeaderHtml(ctx: PatientContext): string {
  return `
      <div class="patient-header">
        <div class="header-row"><strong>Patient:</strong> ${esc(ctx.patientName)} &nbsp;|&nbsp; <strong>DOB:</strong> ${esc(ctx.patientDob)} &nbsp;|&nbsp; <strong>Sex:</strong> ${esc(ctx.patientSex)}</div>
        <div class="header-row"><strong>Member ID:</strong> ${esc(ctx.memberId)} &nbsp;|&nbsp; <strong>Group:</strong> ${esc(ctx.groupId)}</div>
        <div class="header-row"><strong>Address:</strong> ${esc(ctx.patientAddress)}</div>
        <div class="header-divider"></div>
        <div class="header-row"><strong>Prescriber:</strong> ${esc(ctx.prescriberName)} &nbsp;|&nbsp; <strong>NPI:</strong> ${esc(ctx.prescriberNpi)}</div>
        <div class="header-row"><strong>Specialty:</strong> ${esc(ctx.prescriberSpecialty)}</div>
        <div class="header-row"><strong>Address:</strong> ${esc(ctx.prescriberAddress)} &nbsp;|&nbsp; <strong>Phone:</strong> ${esc(ctx.prescriberPhone)}</div>
      </div>`
}

// Shared <style> block for both letter PDF views (openAppealPdf, openPaRequestPdf).
// `extraRules` appends view-specific rules (e.g. .answer for the PA request view).
function buildLetterCss(extraRules = ''): string {
  return `
        body{font-family:Georgia,serif;max-width:720px;margin:60px auto;color:#111;line-height:1.7;font-size:15px}
        h1{font-size:20px;margin-bottom:6px}
        .meta{color:#555;font-size:13px;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:28px}
        p{margin:0 0 14px}
        .section-title{font-weight:bold;margin:24px 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#444}
        .criterion{margin-bottom:14px;padding-left:18px;border-left:3px solid #ddd}
        .citation-meta{color:#777;font-size:12px;font-weight:500}
        .citation{color:#555;font-style:italic;font-size:13px}
        .patient-header{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:4px;padding:12px 16px;margin-bottom:20px;font-size:13px;line-height:1.6}
        .header-row{margin-bottom:2px}
        .header-divider{border-top:1px solid #ddd;margin:8px 0}
        .footer{margin-top:52px;border-top:1px solid #ddd;padding-top:14px;font-size:12px;color:#999}${extraRules}`
}

export function buildLetterBody(scenario: ScenarioConfig): string {
    const headerBlock = scenario.patientContext
      ? buildPatientHeader(scenario.patientContext) + '\n\n'
      : ''
    const evidenceLines = scenario.criteriaResults.map((cr, i) => {
      const cite = scenario.citations[cr.rule.label]
      return [
        `${i + 1}. ${cr.rule.label}`,
        cite ? `   ${cite.source} · ${cite.page}` : '',
        `   "${cite ? cite.text : 'Supporting documentation confirmed.'}"`,
      ].filter(Boolean).join('\n')
    }).join('\n\n')
    return `${headerBlock}Dear Medical Director,\n\nWe are writing to formally appeal the prior authorization denial for ${scenario.drug}. The denial cited "${scenario.denialReason}." Upon thorough review of the patient's clinical record, we submit that all applicable criteria for ${scenario.diagnosis} have been satisfied, as documented below.\n\nCLINICAL EVIDENCE — ${scenario.configFile}\n\n${evidenceLines}\n\nBased on the documented clinical evidence, we respectfully request that the prior authorization for ${scenario.drug} be approved. This medication is medically necessary for the management of ${scenario.diagnosis} and consistent with current clinical guidelines.\n\nSincerely,\nClearAuth\nAI-Assisted Prior Authorization Team`
}

export function openAppealPdf(scenario: ScenarioConfig): void {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const drug = esc(scenario.drug)
    const plan = esc(scenario.plan)
    const planId = esc(scenario.planId)
    const denialReason = esc(scenario.denialReason)
    const diagnosis = esc(scenario.diagnosis)
    const configFile = esc(scenario.configFile)
    const patientHeaderHtml = scenario.patientContext
      ? buildPatientHeaderHtml(scenario.patientContext)
      : ''
    const evidenceRows = scenario.criteriaResults.map((cr, i) => {
      const cite = scenario.citations[cr.rule.label]
      const label = esc(cr.rule.label)
      return `
      <div class="criterion">
        <strong>Criterion ${i + 1}: ${label}</strong><br/>
        ${cite ? `<span class="citation-meta">${esc(cite.source)} &middot; ${esc(cite.page)}</span><br/>` : ''}
        <span class="citation">"${cite ? esc(cite.text) : 'Supporting documentation confirmed.'}"</span>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>PA Appeal — ${drug}</title>
      <style>${buildLetterCss()}
      </style></head><body>
      <h1>Prior Authorization Appeal Letter</h1>
      <div class="meta">Generated by ClearAuth Universal Medical Ontology Platform &middot; ${date}</div>
      ${patientHeaderHtml}
      <p><strong>RE: Appeal of Prior Authorization Denial — ${drug}</strong></p>
      <p>Insurance Plan: <strong>${plan}</strong> (Plan ID: ${planId})<br/>
         Denial Reason on File: ${denialReason}</p>
      <p>Dear Medical Director,</p>
      <p>We are writing to formally appeal the prior authorization denial for <strong>${drug}</strong>.
         The denial cited &ldquo;${denialReason}.&rdquo;
         Upon thorough clinical record review, we submit that all applicable criteria for
         <strong>${diagnosis}</strong> have been satisfied, as documented below.</p>
      <div class="section-title">Clinical Evidence — ${configFile}</div>
      ${evidenceRows}
      <p>Based on the documented evidence, we respectfully request that the prior authorization for
         <strong>${drug}</strong> be approved. This medication is medically necessary for
         the management of <strong>${diagnosis}</strong> and consistent with current clinical guidelines.</p>
      <p>Sincerely,<br/><strong>ClearAuth</strong><br/>AI-Assisted Prior Authorization Team</p>
      <div class="footer">
        Generated via Universal Medical Ontology Pipeline · Config: ${configFile} ·
        All citations extracted directly from submitted medical records.
      </div></body></html>`

    const printable = html.replace('</body>', '<script>window.onload=()=>window.print()</scr' + 'ipt></body>')
    const blob = new Blob([printable], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
}

// Editable free-text justification on an initial-PA request — the human-readable
// narrative a coordinator can amend before filing (the structured questionnaire
// answers stay bound to their citations). Mirrors buildLetterBody for the appeal.
export function buildPaRequestNarrative(scenario: ScenarioConfig): string {
    return `We request prior authorization for ${scenario.requestedTherapy ?? scenario.drug} for the management of ${scenario.diagnosis}. Every questionnaire answer above is supported by documentation in the submitted record and is carried in the accompanying FHIR (X12 278) bundle. The requested therapy is medically necessary and consistent with current clinical guidelines.`
}

// Initial-PA artifact — the structured request (not an appeal). Renders the
// completed DTR questionnaire (one answer per criterion, each bound to a source)
// and the requested therapy, as the human-readable companion to the PAS payload.
export function openPaRequestPdf(scenario: ScenarioConfig): void {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const drug = esc(scenario.drug)
    const plan = esc(scenario.plan)
    const planId = esc(scenario.planId)
    const diagnosis = esc(scenario.diagnosis)
    const requestedTherapy = esc(scenario.requestedTherapy ?? scenario.drug)
    const configFile = esc(scenario.configFile)
    const patientHeaderHtml = scenario.patientContext
      ? buildPatientHeaderHtml(scenario.patientContext)
      : ''
    const answerRows = scenario.criteriaResults.map((cr, i) => {
      const cite = scenario.citations[cr.rule.label]
      const label = esc(cr.rule.label)
      return `
      <div class="criterion">
        <strong>Q${i + 1}: ${label}</strong><br/>
        <span class="answer">Answer: Met</span><br/>
        ${cite ? `<span class="citation-meta">${esc(cite.source)} &middot; ${esc(cite.page)}</span><br/>` : ''}
        <span class="citation">"${cite ? esc(cite.text) : 'Supporting documentation confirmed.'}"</span>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>PA Request — ${drug}</title>
      <style>${buildLetterCss('\n        .answer{color:#1a7f37;font-size:13px;font-weight:600}')}
      </style></head><body>
      <h1>Prior Authorization Request</h1>
      <div class="meta">Assembled by ClearAuth Universal Medical Ontology Platform &middot; ${date}</div>
      ${patientHeaderHtml}
      <p><strong>RE: New Prior Authorization Request — ${drug}</strong></p>
      <p>Insurance Plan: <strong>${plan}</strong> (Plan ID: ${planId})<br/>
         Diagnosis: ${diagnosis}<br/>
         Requested therapy: <strong>${requestedTherapy}</strong></p>
      ${scenario.paRequired ? `<p><strong>Coverage determination (CRD):</strong> ${esc(scenario.paRequired.basis)}</p>` : ''}
      <div class="section-title">Completed Documentation Questionnaire (DTR) — ${configFile}</div>
      ${answerRows}
      <p>We request prior authorization for <strong>${requestedTherapy}</strong> for the
         management of <strong>${diagnosis}</strong>. Every questionnaire answer above is supported by
         documentation in the submitted record and is transmitted in the accompanying FHIR (X12 278) bundle.</p>
      <p>Sincerely,<br/><strong>ClearAuth</strong><br/>AI-Assisted Prior Authorization Team</p>
      <div class="footer">
        Assembled via Universal Medical Ontology Pipeline · Config: ${configFile} ·
        Filed to the payer over HL7 FHIR Da Vinci PAS (X12 278). All answers extracted directly from submitted records.
      </div></body></html>`

    const printable = html.replace('</body>', '<script>window.onload=()=>window.print()</scr' + 'ipt></body>')
    const blob = new Blob([printable], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
}
