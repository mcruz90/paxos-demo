"""Unit tests — resume provenance rule (May's honesty ruling, 2026-07-18).

A human approving the machine draft unchanged is a *decision*, not an edit:
the resume record must say `human_approved`, and `human_edited` is reserved
for a letter whose text actually changed. The rule mirrors the hold node's
apply semantics (falsy edited_text keeps the draft) and treats text
byte-identical to the parked draft as an approval, so pasting the letter
back unchanged cannot inflate into `human_edited`.

Run from backend/:
    uv run pytest tests/unit/test_resume_provenance.py -v
"""

from __future__ import annotations

from agents.resume import resume_provenance
from models.schemas import AuditProvenance

_DRAFT = "Dear Medical Director,\n\nThe denial should be reversed.\n"


def test_none_edit_is_human_approved() -> None:
    assert resume_provenance(None, _DRAFT) is AuditProvenance.human_approved


def test_empty_edit_is_human_approved() -> None:
    # The hold node keeps the draft for falsy edited_text — the provenance
    # must describe the artifact that actually leaves.
    assert resume_provenance("", _DRAFT) is AuditProvenance.human_approved


def test_byte_identical_edit_is_human_approved() -> None:
    assert resume_provenance(_DRAFT, _DRAFT) is AuditProvenance.human_approved


def test_changed_text_is_human_edited() -> None:
    assert (
        resume_provenance(_DRAFT + "Revised on review.", _DRAFT)
        is AuditProvenance.human_edited
    )
