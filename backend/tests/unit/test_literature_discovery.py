"""Unit tests for closed typed-query literature & guideline discovery (zero code execution)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from cases.assessment_sources import AssessmentInputs
from cases.discovery import DiscoveryAdapter
from cases.literature_corpus import (
    DEFAULT_LITERATURE_CORPUS,
    LiteratureRecord,
    OfflineLiteratureClient,
)
from cases.literature_discovery import LiteratureDiscovery
from cases.literature_query import (
    LiteratureQueryError,
    LiteratureQuerySpec,
    build_non_phi_query,
)
from models.case_evidence import CaseRecord, SourceVersion
from models.discovery import FullTextSource, MetadataSource


def _sample_case() -> CaseRecord:
    return CaseRecord(
        case_id="case-lit-01", tenant_id="tenant_demo", patient_ref="PT-9988", revision=1
    )


class _RecordingLiteratureClient:
    def __init__(self, inner: OfflineLiteratureClient) -> None:
        self._inner = inner
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def search_literature(
        self, query: str, *, drug: str = "", icd10: str = "", limit: int = 25
    ) -> list[dict[str, Any]]:
        self.calls.append(
            ("search_literature", {"query": query, "drug": drug, "icd10": icd10, "limit": limit})
        )
        return self._inner.search_literature(query, drug=drug, icd10=icd10, limit=limit)

    def fetch_abstract(self, pmid: str) -> dict[str, Any] | None:
        self.calls.append(("fetch_abstract", {"pmid": pmid}))
        return self._inner.fetch_abstract(pmid)

    def list_guidelines(self, drug: str = "", icd10: str = "") -> list[dict[str, Any]]:
        self.calls.append(("list_guidelines", {"drug": drug, "icd10": icd10}))
        return self._inner.list_guidelines(drug=drug, icd10=icd10)


class _TamperedPmidClient(_RecordingLiteratureClient):
    def search_literature(
        self, query: str, *, drug: str = "", icd10: str = "", limit: int = 25
    ) -> list[dict[str, Any]]:
        rows = super().search_literature(query, drug=drug, icd10=icd10, limit=limit)
        fake = {
            "pmid": "99999999",
            "title": "Hallucinated Study",
            "year": 2026,
            "guideline_id": "FAKE-2026",
            "society": "NONE",
            "study_type": "guideline",
            "evidence_grade": 99,
            "drugs": ["esomeprazole"],
            "icd10_codes": ["K21.0"],
            "keywords": ["pediatric", "gerd"],
            "has_abstract": True,
            "term_hits": 99,
        }
        return [fake, *rows]


@dataclass(frozen=True)
class _PhiHeavyReader:
    def read(self, case: CaseRecord) -> AssessmentInputs:
        note = "Patient Alice Wonderland, DOB 1988-05-14, Member ID MBR-774411, SSN 123-45-6789, secret_chart_note_token."
        src = SourceVersion(
            source_version_id="gi-note-v1",
            case_id=case.case_id,
            tenant_id=case.tenant_id,
            category="patient_record",
            patient_ref=case.patient_ref,
            body=note,
            body_sha256=sha256(note.encode("utf-8")).hexdigest(),
            origin_ref="gi-note-v1",
        )
        return AssessmentInputs(
            (src,), "UHC-CHOICE-2026", "esomeprazole", "K21.0", date(1988, 5, 14), None, None
        )


def test_default_corpus_is_synthetic_and_no_code_execution_modules() -> None:
    assert len(DEFAULT_LITERATURE_CORPUS) >= 20
    cases_dir = Path(__file__).resolve().parents[2] / "cases"
    for removed in ("ptc_ast_guard.py", "ptc_runner.py", "ptc_worker.py"):
        assert not (cases_dir / removed).exists()
    raw_text = (cases_dir / "literature_corpus.json").read_text(encoding="utf-8")
    for row in json.loads(raw_text):
        assert row.get("synthetic") is True and re.fullmatch(r"SYNTH-LIT-\d{3}", row["pmid"])
    for society in "NASPGHAN ESPGHAN ACG AGA ACR ADA AASLD GINA AAD KDIGO NEJM JAMA Lancet".split():
        assert not re.search(rf"\b{society}\b", raw_text)


def test_narrows_20_plus_records_to_top_2_in_one_pass() -> None:
    adapter: DiscoveryAdapter = LiteratureDiscovery(client=OfflineLiteratureClient())
    sources = adapter.search(_sample_case(), "esomeprazole K21.0")
    assert len(sources) == 2
    assert all(
        isinstance(item, FullTextSource) and item.title.startswith("[SYNTHETIC] ")
        for item in sources
    )


def test_typed_query_spec_filters_and_sorts_by_evidence_grade() -> None:
    adapter = LiteratureDiscovery(client=OfflineLiteratureClient())
    spec = LiteratureQuerySpec(
        drug="esomeprazole",
        indication_or_icd10="K21.0",
        min_year=2022,
        study_types=("guideline", "cohort"),
        required_terms=("dysphagia",),
        exclude_terms=("icu",),
        sort_by="evidence_grade",
        top_k=2,
        max_excerpt_chars=160,
    )
    sources = adapter.search_with_spec(_sample_case(), spec)
    assert [s.source_id for s in sources] == ["SYNTH-LIT-001", "SYNTH-LIT-005"]
    assert isinstance(sources[0], FullTextSource) and len(sources[0].excerpt) <= 160


@pytest.mark.parametrize(
    "bad_payload",
    [
        {"drug": "esomeprazole", "unexpected_field": "x"},
        {"drug": "esomeprazole", "top_k": 50},
        {"drug": "esomeprazole", "min_year": 1800},
        {"drug": "esomeprazole", "max_excerpt_chars": 10},
        {"drug": "esomeprazole", "sort_by": "arbitrary_sql"},
        {"drug": "import os; os.system('calc')"},
        {"indication_or_icd10": "__import__('os').name"},
        {"required_terms": ['"{0.__class__}".format(0)']},
    ],
)
def test_strict_pydantic_rejects_unknown_fields_bounds_and_code_injection(
    bad_payload: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        LiteratureQuerySpec.model_validate(bad_payload)


def test_verbatim_span_verification_matches_corpus_record() -> None:
    corpus_by_pmid = {rec.pmid: rec for rec in DEFAULT_LITERATURE_CORPUS}
    adapter = LiteratureDiscovery(client=OfflineLiteratureClient())
    sources = adapter.search(_sample_case(), "esomeprazole K21.0")
    assert len(sources) == 2
    for item in sources:
        assert isinstance(item, FullTextSource)
        pmid = item.source_id.removeprefix("pmid-")
        rec = corpus_by_pmid[pmid]
        assert rec.abstract is not None
        assert rec.abstract[item.start : item.end] == item.excerpt
        assert item.content_sha256 == sha256(rec.abstract.encode("utf-8")).hexdigest()


def test_hallucinated_pmid_from_search_is_dropped_by_host_verification() -> None:
    client = _TamperedPmidClient(OfflineLiteratureClient())
    adapter = LiteratureDiscovery(client=client)
    sources = adapter.search(_sample_case(), "esomeprazole K21.0")
    assert len(sources) == 2
    assert all(src.source_id != "pmid-99999999" for src in sources)


def test_metadata_only_record_emits_metadata_source() -> None:
    meta_only = LiteratureRecord(
        "SYNTH-LIT-999",
        "Synthetic Pediatric GERD index",
        None,
        "SYNTH-GL-999",
        "Synthetic Pediatric GI Test Corpus",
        2024,
        ("esomeprazole",),
        ("K21.0",),
        ("gerd", "pediatric"),
    )
    sources = LiteratureDiscovery(client=OfflineLiteratureClient(records=(meta_only,))).search(
        _sample_case(), "esomeprazole K21.0"
    )
    assert len(sources) == 1 and isinstance(sources[0], MetadataSource)
    assert (
        sources[0].title.startswith("[SYNTHETIC] ") and sources[0].availability == "metadata_only"
    )
    assert sources[0].start is None and sources[0].end is None and sources[0].excerpt is None


def test_phi_isolation_blocks_case_notes_names_dobs_member_ids() -> None:
    recorder = _RecordingLiteratureClient(OfflineLiteratureClient())
    dirty_query = "Patient Alice Wonderland DOB 05/14/1988 1988-05-14 MBR-774411 PH-9988 {{PATIENT_NAME}} esomeprazole K21.0"
    sources = LiteratureDiscovery(client=recorder, context_reader=_PhiHeavyReader()).search(
        _sample_case(), dirty_query
    )
    assert len(sources) == 2
    serialized_args = repr(recorder.calls)
    forbidden = (
        "Alice Wonderland 1988-05-14 05/14/1988 MBR-774411 123-45-6789 "
        "PH-9988 PT-9988 PATIENT_NAME secret_chart_note_token UHC-CHOICE-2026"
    ).split()
    for token in forbidden:
        assert token not in serialized_args
    assert "esomeprazole" in serialized_args.lower() and "k21.0" in serialized_args.lower()


@pytest.mark.parametrize(
    ("raw_query", "expected_drug", "expected_indication", "expected_pmid"),
    [
        ("Eosinophilic Esophagitis", "", "eosinophilic esophagitis", "SYNTH-LIT-010"),
        ("Prescription Omeprazole", "omeprazole", "", "SYNTH-LIT-003"),
        ("Crohn Disease K50.90", "", "Crohn Disease K50.90", "SYNTH-LIT-007"),
    ],
)
def test_h3_clinical_terms_preserved_without_lossy_titlecase_regex(
    raw_query: str, expected_drug: str, expected_indication: str, expected_pmid: str
) -> None:
    spec = build_non_phi_query(query=raw_query)
    assert spec.drug == expected_drug
    assert expected_indication.lower() in spec.indication_or_icd10.lower()
    adapter = LiteratureDiscovery(client=OfflineLiteratureClient())
    assert any(src.source_id == expected_pmid for src in adapter.search(_sample_case(), raw_query))


def test_h3_lowercase_patient_name_and_mrn_never_reach_client() -> None:
    recorder = _RecordingLiteratureClient(OfflineLiteratureClient())
    adapter = LiteratureDiscovery(client=recorder)
    sources = adapter.search(_sample_case(), "omeprazole for jane doe mrn 88123")
    assert len(sources) >= 1
    serialized_args = repr(recorder.calls).lower()
    assert "omeprazole" in serialized_args
    for leaked in ("jane", "doe", "mrn", "88123", "for "):
        assert leaked not in serialized_args


def test_h3_structured_and_free_text_drug_isolation() -> None:
    spec = build_non_phi_query({"drug": "omeprazole for jane doe mrn 88123", "diagnosis": "K21.0"})
    assert spec.drug == "omeprazole" and spec.indication_or_icd10 == "K21.0"
    assert build_non_phi_query({"drug": "jane doe chart note", "diagnosis": "K21.0"}).drug == ""
    free = build_non_phi_query(query="jane doe omeprazole")
    assert free.drug == "omeprazole" and free.indication_or_icd10 == ""


def test_m2_injection_in_case_drug_raises_typed_literature_query_error() -> None:
    class _BadDrugReader:
        def read(self, case: CaseRecord) -> AssessmentInputs:
            return AssessmentInputs(
                (), "UHC-CHOICE-2026", "esomeprazole; import os", "K21.0", None, None, None
            )

    adapter = LiteratureDiscovery(client=OfflineLiteratureClient(), context_reader=_BadDrugReader())
    with pytest.raises(LiteratureQueryError):
        adapter.search(_sample_case(), "")


def test_l1_tampered_abstract_for_canonical_pmid_is_dropped() -> None:
    class _TamperedAbstractClient(_RecordingLiteratureClient):
        def fetch_abstract(self, pmid: str) -> dict[str, Any] | None:
            row = super().fetch_abstract(pmid)
            return {**row, "abstract": "Tampered."} if row and pmid == "SYNTH-LIT-001" else row

    sources = LiteratureDiscovery(client=_TamperedAbstractClient(OfflineLiteratureClient())).search(
        _sample_case(), "esomeprazole K21.0"
    )
    assert all(src.source_id != "SYNTH-LIT-001" for src in sources)
