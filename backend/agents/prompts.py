"""agents/prompts.py — prompt templates for the appeal pipeline.

Single home for prompt text (CLAUDE.md DRY rule: never inline a multi-line
prompt string in a node file). Nodes format these templates; they do not
define prompt copy.

Security invariant: untrusted content (denial_text, pa_context) is only ever
substituted inside the XML-delimited slots — the model sees it as data, not
instructions.
"""

from __future__ import annotations

APPEAL_SYSTEM_INSTRUCTIONS = (
    "You are a clinical appeals specialist writing a formal prior authorization "
    "appeal letter on behalf of a prescribing physician. "
    "The letter must be professional, evidence-based, and cite the specific "
    "clinical criteria from the payer's PA policy. "
    "Do not introduce yourself as an AI. Write the letter directly."
)

APPEAL_PROMPT_TEMPLATE = (
    "{system_instructions}\n\n"
    "Drug: {drug}\n"
    "Diagnosis: {diagnosis}\n"
    "Plan: {plan}\n\n"
    "<pa_requirements>\n{pa_context}\n</pa_requirements>\n\n"
    "<denial_letter>\n{denial_text}\n</denial_letter>\n\n"
    "Write a formal prior authorization appeal letter addressing the denial reason. "
    "Cite the clinical evidence and PA criteria directly. "
    "Begin the letter with 'Dear Medical Director,'"
)
