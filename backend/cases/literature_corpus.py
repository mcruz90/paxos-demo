"""Offline public PubMed & clinical guideline corpus for typed literature discovery."""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


@dataclass(frozen=True)
class LiteratureRecord:
    pmid: str
    title: str
    abstract: str | None
    guideline_id: str | None
    society: str | None
    year: int
    drugs: tuple[str, ...]
    icd10_codes: tuple[str, ...]
    keywords: tuple[str, ...]
    study_type: str | None = None
    evidence_grade: int | None = None
    synthetic: bool = True


class LiteratureClient(Protocol):
    def search_literature(
        self, query: str, *, drug: str = "", icd10: str = "", limit: int = 25
    ) -> list[dict[str, Any]]: ...

    def fetch_abstract(self, pmid: str) -> dict[str, Any] | None: ...

    def list_guidelines(self, drug: str = "", icd10: str = "") -> list[dict[str, Any]]: ...


def _load_corpus() -> tuple[LiteratureRecord, ...]:
    raw = json.loads(Path(__file__).with_name("literature_corpus.json").read_text("utf-8"))
    return tuple(
        LiteratureRecord(
            pmid=item["pmid"],
            title=item["title"],
            abstract=item["abstract"],
            guideline_id=item["guideline_id"],
            society=item["society"],
            year=item["year"],
            drugs=tuple(item["drugs"]),
            icd10_codes=tuple(item["icd10_codes"]),
            keywords=tuple(item["keywords"]),
            study_type=item["study_type"],
            evidence_grade=item["evidence_grade"],
            synthetic=bool(item["synthetic"]),
        )
        for item in raw
    )


DEFAULT_LITERATURE_CORPUS: tuple[LiteratureRecord, ...] = _load_corpus()


class OfflineLiteratureClient:
    """Zero-network read-only literature client backed by public fixture records."""

    def __init__(self, records: Sequence[LiteratureRecord] = DEFAULT_LITERATURE_CORPUS) -> None:
        self._records = tuple(records)
        self._by_pmid = {rec.pmid: rec for rec in self._records}

    @property
    def records(self) -> tuple[LiteratureRecord, ...]:
        return self._records

    def search_literature(
        self, query: str, *, drug: str = "", icd10: str = "", limit: int = 25
    ) -> list[dict[str, Any]]:
        terms = [t for t in (query + " " + drug + " " + icd10).casefold().split() if t]
        out: list[dict[str, Any]] = []
        for rec in self._records:
            blob = " ".join((rec.title, *rec.drugs, *rec.icd10_codes, *rec.keywords)).casefold()
            hits = sum(1 for term in terms if re.search(rf"\b{re.escape(term)}\b", blob))
            out.append(
                {
                    "pmid": rec.pmid,
                    "title": rec.title,
                    "year": rec.year,
                    "guideline_id": rec.guideline_id,
                    "society": rec.society,
                    "study_type": rec.study_type or ("guideline" if rec.guideline_id else "cohort"),
                    "evidence_grade": rec.evidence_grade or (3 if rec.guideline_id else 2),
                    "drugs": list(rec.drugs),
                    "icd10_codes": list(rec.icd10_codes),
                    "keywords": list(rec.keywords),
                    "has_abstract": rec.abstract is not None,
                    "term_hits": hits,
                    "synthetic": rec.synthetic,
                }
            )
        out.sort(key=lambda r: (r["term_hits"], r["year"]), reverse=True)
        return out[: max(1, min(limit, len(out)))]

    def fetch_abstract(self, pmid: str) -> dict[str, Any] | None:
        rec = self._by_pmid.get(pmid)
        if rec is None:
            return None
        return {
            "pmid": rec.pmid,
            "title": rec.title,
            "abstract": rec.abstract,
            "guideline_id": rec.guideline_id,
            "year": rec.year,
            "synthetic": rec.synthetic,
        }

    def list_guidelines(self, drug: str = "", icd10: str = "") -> list[dict[str, Any]]:
        d_cf, c_cf = drug.casefold().strip(), icd10.casefold().strip()
        results: list[dict[str, Any]] = []
        for rec in self._records:
            if rec.guideline_id is None:
                continue
            drug_ok = not d_cf or any(d_cf in d.casefold() for d in rec.drugs)
            code_ok = not c_cf or any(c_cf == c.casefold() for c in rec.icd10_codes)
            if drug_ok or code_ok:
                results.append(
                    {
                        "pmid": rec.pmid,
                        "guideline_id": rec.guideline_id,
                        "society": rec.society,
                        "title": rec.title,
                        "year": rec.year,
                    }
                )
        return results
