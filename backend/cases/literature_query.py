"""Strict Pydantic typed-query specification and closed-vocab non-PHI builder."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from cases.literature_corpus import DEFAULT_LITERATURE_CORPUS

StudyType = Literal["guideline", "rct", "cohort", "review", "case_series"]
SortBy = Literal["relevance", "year", "evidence_grade"]


class LiteratureQueryError(ValueError):
    """Typed domain error raised when a literature query fails validation (maps to HTTP 422)."""


_ICD10_RE = re.compile(r"\b[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?\b", re.IGNORECASE)

_KNOWN_DRUGS: tuple[str, ...] = tuple(
    sorted(
        {drug.casefold() for rec in DEFAULT_LITERATURE_CORPUS for drug in rec.drugs},
        key=len,
        reverse=True,
    )
)

_EXTRA_CONDITIONS: frozenset[str] = frozenset(
    {
        "crohn disease",
        "type 2 diabetes",
        "primary biliary cholangitis",
        "atopic dermatitis",
        "chronic kidney disease",
        "laryngopharyngeal reflux",
        "barrett esophagus",
        "chronic constipation",
        "functional dyspepsia",
        "inflammatory bowel disease",
        "gastroesophageal reflux disease",
    }
)

_KNOWN_CONDITIONS: tuple[str, ...] = tuple(
    sorted(
        (
            {kw.casefold() for rec in DEFAULT_LITERATURE_CORPUS for kw in rec.keywords}
            | _EXTRA_CONDITIONS
        )
        - set(_KNOWN_DRUGS),
        key=len,
        reverse=True,
    )
)

_CODE_INJECTION_PATTERN = re.compile(
    r"(?:__|;|\r|\n|\{\{|\}\}|\{0\.|\bimport\s|\beval\s*\(|\bexec\s*\("
    r"|\bcompile\s*\(|\bopen\s*\(|\bcall_tool\s*\(|\bgi_frame\b|\bcr_frame\b"
    r"|\bf_globals\b|\.format(?:_map)?\s*\()",
    re.IGNORECASE,
)


def _reject_injection(value: str) -> str:
    if _CODE_INJECTION_PATTERN.search(value):
        raise ValueError("disallowed_query_syntax")
    return value.strip()


class LiteratureQuerySpec(BaseModel):
    """Closed typed query contract for public literature/guideline discovery."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    drug: Annotated[str, Field(max_length=120)] = ""
    indication_or_icd10: Annotated[str, Field(max_length=120)] = ""
    min_year: Annotated[int | None, Field(ge=1900, le=2100)] = None
    study_types: tuple[StudyType, ...] = Field(default=(), max_length=5)
    required_terms: tuple[Annotated[str, Field(min_length=1, max_length=64)], ...] = Field(
        default=(), max_length=10
    )
    exclude_terms: tuple[Annotated[str, Field(min_length=1, max_length=64)], ...] = Field(
        default=(), max_length=10
    )
    sort_by: SortBy = "relevance"
    top_k: Annotated[int, Field(ge=1, le=10)] = 2
    max_excerpt_chars: Annotated[int, Field(ge=50, le=1000)] = 240

    @field_validator("drug", "indication_or_icd10")
    @classmethod
    def _validate_scalar_text(cls, value: str) -> str:
        return _reject_injection(value)

    @field_validator("required_terms", "exclude_terms")
    @classmethod
    def _validate_term_tuple(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(_reject_injection(item) for item in values)


def _match_known_term(text: str, vocab: tuple[str, ...]) -> str:
    for term in vocab:
        match = re.search(rf"\b{re.escape(term)}\b", text, re.IGNORECASE)
        if match:
            return match.group(0)
    return ""


def _extract_closed_vocab_indication(text: str) -> str:
    parts: list[str] = []
    cond = _match_known_term(text, _KNOWN_CONDITIONS)
    if cond:
        parts.append(cond)
    for code in _ICD10_RE.findall(text):
        upper_code = code.upper()
        if upper_code not in {p.upper() for p in parts}:
            parts.append(upper_code)
    return " ".join(parts)[:120]


def _extract_raw_fields(source: Any) -> tuple[str, str]:
    if isinstance(source, Mapping):
        drug = str(source.get("drug") or "")
        for key in ("indication_or_icd10", "icd10", "diagnosis"):
            if source.get(key):
                return drug, str(source[key])
        return drug, ""
    drug = str(getattr(source, "drug", "") or "")
    for attr in ("indication_or_icd10", "icd10", "diagnosis"):
        val = getattr(source, attr, None)
        if val:
            return drug, str(val)
    return drug, ""


def build_non_phi_query(
    source: Any = None, *, query: str = "", top_k: int = 2
) -> LiteratureQuerySpec:
    """Build a LiteratureQuerySpec strictly from structured case fields or closed vocab.

    When *source* supplies structured ``drug`` / ``diagnosis`` fields (such as
    ``AssessmentInputs`` from ``context_reader``), free-text *query* is ignored so
    untrusted request text cannot inject PHI. When *source* is ``None``, *query* is
    parsed strictly through the closed drug, condition, and ICD-10 vocabularies.
    """
    if isinstance(source, LiteratureQuerySpec):
        return source
    if source is not None:
        raw_drug, raw_ind = _extract_raw_fields(source)
        if _CODE_INJECTION_PATTERN.search(raw_drug) or _CODE_INJECTION_PATTERN.search(raw_ind):
            raise LiteratureQueryError("disallowed_query_syntax")
        drug = _match_known_term(raw_drug, _KNOWN_DRUGS).lower()[:120]
        indication = _extract_closed_vocab_indication(raw_ind)
    else:
        if _CODE_INJECTION_PATTERN.search(query):
            raise LiteratureQueryError("disallowed_query_syntax")
        drug = _match_known_term(query, _KNOWN_DRUGS).lower()[:120]
        indication = _extract_closed_vocab_indication(query)
    try:
        return LiteratureQuerySpec(
            drug=drug,
            indication_or_icd10=indication,
            top_k=max(1, min(top_k, 10)),
        )
    except ValidationError as exc:
        raise LiteratureQueryError(f"invalid_literature_query:{exc.error_count()}") from exc
