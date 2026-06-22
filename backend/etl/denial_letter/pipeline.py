"""etl/denial_letter/pipeline.py — Denial letter ETL pipeline.

Orchestrates file detection → text extraction → field parsing →
security hold detection → AppealRequest construction.

Entry point: process_denial_letter(raw_bytes, filename) -> AppealRequest
"""

from __future__ import annotations

import re

from etl.denial_letter.file_detector import FileType, detect
from models.schemas import AppealRequest, CriterionResult, CriterionStatus, Rule, RuleType
from security.sanitize import ocr_consistency_check, sanitize_extracted_text

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_BYTES = 5 * 1024 * 1024  # 5 MB

# ---------------------------------------------------------------------------
# Field extraction — lightweight heuristic regex
# ---------------------------------------------------------------------------

_DRUG_RE = re.compile(
    r"(?:for|authorization for|treatment with)\s+([A-Za-z][A-Za-z\s\(\)]{2,50}?)(?:\s*has been|\s*was|\s*is|\.|,)",
    re.IGNORECASE,
)
_DIAGNOSIS_RE = re.compile(
    r"(?:diagnosis|diagnos\w*|condition|indication)[:\s]+([A-Za-z][A-Za-z\s\-]{3,80}?)(?:\s*\(|\.|\,|$)",
    re.IGNORECASE,
)
_DENIAL_REASON_RE = re.compile(
    r"(?:denial reason|reason for denial|denied because|denied[:;]\s*|reason[:;]\s*)"
    r"([A-Za-z][^.\n]{5,200}?)(?:\.|$)",
    re.IGNORECASE,
)
_PLAN_RE = re.compile(
    r"(?:plan|insurance|payer)[:\s]+([A-Za-z][A-Za-z\s]{2,80}?)(?:\.|,|$)",
    re.IGNORECASE,
)
_PLAN_ID_RE = re.compile(
    r"(?:plan id|policy|member id|group)[:\s#]+([A-Z0-9\-]{3,30})",
    re.IGNORECASE,
)
_ICD_RE = re.compile(r"\b([A-Z]\d{2}\.?\d{0,4})\b")


def _extract_text_from_bytes(raw_bytes: bytes, file_type: FileType) -> str:
    """Extract plain text from *raw_bytes* according to *file_type*."""
    if file_type == FileType.text:
        return raw_bytes.decode("utf-8", errors="replace")

    if file_type == FileType.pdf:
        import fitz  # type: ignore[import]

        doc = fitz.open(stream=raw_bytes, filetype="pdf")
        pages = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(pages)

    if file_type == FileType.image:
        import io

        import pytesseract  # type: ignore[import]
        from PIL import Image

        img = Image.open(io.BytesIO(raw_bytes))
        return pytesseract.image_to_string(img)

    return ""  # unreachable


def _check_security_hold(raw_bytes: bytes, file_type: FileType) -> tuple[bool, str]:
    """Check for hidden/injected content in PDF files."""
    if file_type != FileType.pdf:
        return False, ""

    import pathlib
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(raw_bytes)
        tmp_path = pathlib.Path(tmp.name)

    try:
        result = ocr_consistency_check(tmp_path)
        if result.has_hidden_content:
            return True, f"Hidden text detected ({result.details})"
        return False, ""
    finally:
        tmp_path.unlink(missing_ok=True)


def process_denial_letter(raw_bytes: bytes, filename: str) -> AppealRequest:
    """Process an uploaded denial letter and return an :class:`AppealRequest`.

    Args:
        raw_bytes: Raw file content.
        filename:  Original filename (used only for logging; not trusted for type detection).

    Returns:
        A validated :class:`AppealRequest` constructed from extracted fields.

    Raises:
        ValueError: If input is empty, oversized, or an unsupported file type.
    """
    # --- Guards ---
    if not raw_bytes:
        raise ValueError("empty input: denial letter has no content")
    if len(raw_bytes) > MAX_BYTES:
        raise ValueError(
            f"file size limit exceeded: {len(raw_bytes)} bytes > {MAX_BYTES} bytes"
        )

    # --- File type detection (may raise ValueError for unsupported types) ---
    file_type = detect(raw_bytes)

    # --- Text extraction ---
    raw_text = _extract_text_from_bytes(raw_bytes, file_type)

    # --- Sanitization ---
    sanitized = sanitize_extracted_text(raw_text)
    clean_text = sanitized.clean_text

    # --- Security hold detection ---
    security_hold, security_reason = _check_security_hold(raw_bytes, file_type)

    # --- Field extraction ---
    drug_match = _DRUG_RE.search(clean_text)
    drug = drug_match.group(1).strip() if drug_match else "Unknown Drug"

    diagnosis_match = _DIAGNOSIS_RE.search(clean_text)
    diagnosis = diagnosis_match.group(1).strip() if diagnosis_match else "Unknown Diagnosis"

    denial_reason_match = _DENIAL_REASON_RE.search(clean_text)
    denial_reason = denial_reason_match.group(1).strip() if denial_reason_match else "Not specified"

    plan_match = _PLAN_RE.search(clean_text)
    plan = plan_match.group(1).strip() if plan_match else "Unknown Plan"

    plan_id_match = _PLAN_ID_RE.search(clean_text)
    plan_id = plan_id_match.group(1).strip() if plan_id_match else "UNKNOWN"

    # Extract ICD codes as basic criteria results
    icd_codes = _ICD_RE.findall(clean_text)
    criteria_results: list[CriterionResult] = [
        CriterionResult(
            rule=Rule(type=RuleType.diagnostic, label=code),
            status=CriterionStatus.found,
            note="ICD code extracted from document",
            docSource="etl:extracted",
        )
        for code in icd_codes[:5]  # cap at 5 codes
    ]

    # Build a safe scenario_id from the drug name
    scenario_id = re.sub(r"[^a-z0-9\-]", "-", drug.lower().split("(")[0].strip())[:64]
    scenario_id = re.sub(r"-+", "-", scenario_id).strip("-") or "unknown-drug"

    return AppealRequest(
        scenario_id=scenario_id,
        drug=drug,
        diagnosis=diagnosis,
        denial_text=clean_text[:5000],  # cap at schema max
        denial_reason=denial_reason[:500],
        plan=plan,
        plan_id=plan_id,
        criteria_results=criteria_results,
        security_hold=security_hold,
        security_reason=security_reason,
    )
