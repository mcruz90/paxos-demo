"""Static DiscoveryAdapter with closed typed queries for public literature & guidelines."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any

from cases.assessment_sources import SourceReader
from cases.discovery import Source
from cases.literature_corpus import (
    DEFAULT_LITERATURE_CORPUS,
    LiteratureClient,
    LiteratureRecord,
    OfflineLiteratureClient,
)
from cases.literature_query import (
    LiteratureQueryError,
    LiteratureQuerySpec,
    build_non_phi_query,
)
from models.case_evidence import CaseRecord
from models.discovery import FullTextSource, MetadataSource

__all__ = [
    "DEFAULT_LITERATURE_CORPUS",
    "LiteratureClient",
    "LiteratureDiscovery",
    "LiteratureQueryError",
    "LiteratureQuerySpec",
    "LiteratureRecord",
    "OfflineLiteratureClient",
    "build_non_phi_query",
]

_CORPUS_BY_PMID: dict[str, LiteratureRecord] = {rec.pmid: rec for rec in DEFAULT_LITERATURE_CORPUS}


def _candidate_blob(candidate: dict[str, Any]) -> str:
    parts = [
        str(candidate.get("title") or ""),
        *[str(d) for d in candidate.get("drugs", ())],
        *[str(c) for c in candidate.get("icd10_codes", ())],
        *[str(k) for k in candidate.get("keywords", ())],
    ]
    return " ".join(parts).casefold()


def _terms_match(searchable: str, spec: LiteratureQuerySpec) -> bool:
    if any(term.casefold() not in searchable for term in spec.required_terms):
        return False
    return not any(term.casefold() in searchable for term in spec.exclude_terms)


def _matches_spec(
    candidate: dict[str, Any], abstract_text: str | None, spec: LiteratureQuerySpec
) -> bool:
    year = int(candidate.get("year") or 0)
    if spec.min_year is not None and year < spec.min_year:
        return False
    if spec.study_types:
        stype = str(candidate.get("study_type") or "cohort")
        if stype not in spec.study_types:
            return False
    searchable = f"{_candidate_blob(candidate)} {(abstract_text or '').casefold()}"
    return _terms_match(searchable, spec)


def _has_match(needle: str, haystack: Any, *, exact: bool = False) -> bool:
    if not needle:
        return False
    needle_cf = needle.casefold()
    if exact:
        return any(str(item).casefold() in needle_cf for item in haystack)
    return any(
        re.search(rf"\b{re.escape(str(item).casefold())}\b", needle_cf)
        or re.search(rf"\b{re.escape(needle_cf)}\b", str(item).casefold())
        for item in haystack
    )


def _relevance_points(
    candidate: dict[str, Any], spec: LiteratureQuerySpec, guideline_pmids: set[str]
) -> int:
    score = int(candidate.get("term_hits") or 0) * 2
    if _has_match(spec.drug, candidate.get("drugs", ())):
        score += 5
    if _has_match(spec.indication_or_icd10, candidate.get("icd10_codes", ()), exact=True):
        score += 5
    if str(candidate.get("pmid") or "") in guideline_pmids:
        score += 3
    if candidate.get("has_abstract"):
        score += 2
    return score


def _score_candidate(
    candidate: dict[str, Any], spec: LiteratureQuerySpec, guideline_pmids: set[str]
) -> tuple[int, int, int, str]:
    score = _relevance_points(candidate, spec, guideline_pmids)
    year = int(candidate.get("year") or 0)
    grade = int(candidate.get("evidence_grade") or (3 if candidate.get("guideline_id") else 2))
    pmid = str(candidate.get("pmid") or "")
    if spec.sort_by == "year":
        return (year, score, grade, pmid)
    if spec.sort_by == "evidence_grade":
        return (grade, score, year, pmid)
    return (score, year, grade, pmid)


def _matches_canonical(expected_pmid: str, excerpt: str, end: int) -> bool:
    canonical = _CORPUS_BY_PMID.get(expected_pmid)
    if canonical is None or canonical.abstract is None:
        return True
    return 0 < end <= len(canonical.abstract) and canonical.abstract.startswith(excerpt)


def _source_ids(expected_pmid: str) -> tuple[str, str]:
    source_id = expected_pmid if expected_pmid.startswith("SYNTH-") else f"pmid-{expected_pmid}"
    return source_id, f"{source_id}-v1"


def _format_title(record: dict[str, Any], expected_pmid: str) -> str:
    raw_title = str(record.get("title") or expected_pmid)
    canonical = _CORPUS_BY_PMID.get(expected_pmid)
    is_synthetic = bool(record.get("synthetic")) or (canonical is not None and canonical.synthetic)
    if is_synthetic and not raw_title.startswith("[SYNTHETIC] "):
        return f"[SYNTHETIC] {raw_title}"[:200]
    return raw_title[:200]


def _to_verified_source(
    record: dict[str, Any], expected_pmid: str, max_excerpt_chars: int
) -> Source | None:
    if str(record.get("pmid") or "") != expected_pmid:
        return None
    title = _format_title(record, expected_pmid)
    abstract = record.get("abstract")
    source_id, version_id = _source_ids(expected_pmid)
    if abstract is None:
        return MetadataSource(
            source_id=source_id,
            source_version_id=version_id,
            category="document_index",
            title=title,
            content_sha256=sha256(title.encode("utf-8")).hexdigest(),
        )
    if not isinstance(abstract, str) or not abstract:
        return None
    end = min(len(abstract), max_excerpt_chars)
    excerpt = abstract[:end]
    if not _matches_canonical(expected_pmid, excerpt, end):
        return None
    return FullTextSource(
        source_id=source_id,
        source_version_id=version_id,
        category="document_index",
        title=title,
        content_sha256=sha256(abstract.encode("utf-8")).hexdigest(),
        start=0,
        end=end,
        excerpt=excerpt,
    )


@dataclass(frozen=True)
class LiteratureDiscovery:
    """Closed typed-query DiscoveryAdapter over public literature (zero code execution)."""

    client: LiteratureClient = field(default_factory=OfflineLiteratureClient)
    context_reader: SourceReader | None = None
    top_k: int = 2

    def search(self, case: CaseRecord, query: str) -> tuple[Source, ...]:
        """Search public literature using non-PHI fields only.

        When ``context_reader`` supplies ``AssessmentInputs`` for *case*, ``drug`` and
        ``diagnosis`` govern the query and free-text *query* is ignored so PHI cannot
        leak. Otherwise *query* is filtered strictly through the closed vocabulary.
        """
        inputs = self.context_reader.read(case) if self.context_reader is not None else None
        spec = build_non_phi_query(inputs, query=query, top_k=self.top_k)
        return self.search_with_spec(case, spec)

    def _verify_candidate(
        self, candidate: dict[str, Any], spec: LiteratureQuerySpec, seen: set[str]
    ) -> Source | None:
        pmid = str(candidate.get("pmid") or "")
        if not pmid or pmid in seen:
            return None
        record = self.client.fetch_abstract(pmid)
        if record is None or not _matches_spec(candidate, record.get("abstract"), spec):
            return None
        return _to_verified_source(record, pmid, spec.max_excerpt_chars)

    def search_with_spec(self, _case: CaseRecord, spec: LiteratureQuerySpec) -> tuple[Source, ...]:
        query_text = " ".join(
            part for part in (spec.drug, spec.indication_or_icd10, *spec.required_terms) if part
        )
        candidates = self.client.search_literature(
            query_text, drug=spec.drug, icd10=spec.indication_or_icd10, limit=25
        )
        guidelines = self.client.list_guidelines(drug=spec.drug, icd10=spec.indication_or_icd10)
        guideline_pmids = {str(g.get("pmid") or "") for g in guidelines}
        ranked = sorted(
            candidates,
            key=lambda c: _score_candidate(c, spec, guideline_pmids),
            reverse=True,
        )
        verified: list[Source] = []
        seen: set[str] = set()
        for candidate in ranked:
            src = self._verify_candidate(candidate, spec, seen)
            if src is None:
                continue
            seen.add(src.source_id.removeprefix("pmid-"))
            verified.append(src)
            if len(verified) >= spec.top_k:
                break
        return tuple(verified)
