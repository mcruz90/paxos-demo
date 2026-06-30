"""RED tests for Steps 1, 2, and 7 — CasePacket domain models, coverage pool loader,
and compliance allowlists.

Exercises:
  Step 1: CasePacket schema (HubClient, Coverage, CoverageInfo, RxDetail, LabResult,
          PaHistoryEvent alias, CasePacket)
  Step 2: Coverage pool data (policy-faithful primaries, COB assignments per anchor)
  Step 7: Closed-pool allowlists (POOL_COVERAGE_MEMBER_IDS, POOL_BINS, POOL_PCNS)

Run from backend/:
    uv run pytest tests/unit/test_case_packet_schema.py -v
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

_COVERAGE_POOL_PATH = (
    Path(__file__).parent.parent.parent / "golden" / "coverage_pool.json"
)

_ALL_ANCHOR_IDS = {
    "ozempic_cigna",
    "esomeprazole_uhc_pediatric",
    "livdelzi_cigna_hepatology",
}

# ── STEP 1: Import gate ───────────────────────────────────────────────────────


def test_case_packet_module_importable() -> None:
    from models.case_packet import (  # noqa: F401
        CasePacket,
        CoverageInfo,
        HubClient,
        LabResult,
        PaHistoryEvent,
        RxDetail,
    )


# ── STEP 1: Coverage sub-model ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plan_type",
    ["commercial", "medicare_advantage", "medicaid", "individual"],
)
def test_coverage_accepts_valid_plan_type(plan_type: str) -> None:
    from models.case_packet import Coverage

    c = Coverage(
        payer="Test Payer",
        plan_type=plan_type,
        plan_id="PLAN-001",
        member_id="MBR12345",
        group_id="GRP-001",
        bin="004336",
        pcn="CIGNA",
        effective_date="2024-01-01",
    )
    assert c.plan_type == plan_type


def test_coverage_rejects_invalid_plan_type() -> None:
    from models.case_packet import Coverage

    with pytest.raises(ValidationError):
        Coverage(
            payer="Test Payer",
            plan_type="government",  # not in the allowed set
            plan_id="PLAN-001",
            member_id="MBR12345",
            group_id="GRP-001",
            bin="004336",
            pcn="CIGNA",
            effective_date="2024-01-01",
        )


# ── STEP 1: HubClient sub-model ───────────────────────────────────────────────


def test_hub_client_accepts_valid_client_type() -> None:
    from models.case_packet import HubClient
    from models.schemas import ClientType

    hc = HubClient(
        client_id="hub-001",
        name="Acme Health Hub",
        type=ClientType.medtech,
        letterhead_name="Acme Health Hub, LLC",
    )
    assert hc.type == ClientType.medtech


def test_hub_client_rejects_invalid_type() -> None:
    from models.case_packet import HubClient

    with pytest.raises(ValidationError):
        HubClient(
            client_id="hub-001",
            name="Acme Health Hub",
            type="pharmacy",  # invalid — not in ClientType
            letterhead_name="Acme Health Hub, LLC",
        )


# ── STEP 1: CoverageInfo sub-model ────────────────────────────────────────────


def test_coverage_info_primary_only() -> None:
    from models.case_packet import Coverage, CoverageInfo

    primary = Coverage(
        payer="UHC",
        plan_type="commercial",
        plan_id="UHC-001",
        member_id="UHC12345",
        group_id="GRP-001",
        bin="610591",
        pcn="MEDCO",
        effective_date="2024-01-01",
    )
    ci = CoverageInfo(primary=primary)
    assert ci.secondary is None
    assert ci.cob_type is None
    assert ci.financials is None


def test_coverage_info_with_medicaid_secondary() -> None:
    from models.case_packet import Coverage, CoverageInfo

    primary = Coverage(
        payer="Cigna",
        plan_type="commercial",
        plan_id="CIGNA-CNF360-2024",
        member_id="CGN001",
        group_id="GRP-001",
        bin="004336",
        pcn="CIGNA",
        effective_date="2024-01-01",
    )
    secondary = Coverage(
        payer="Ohio Medicaid (ODM)",
        plan_type="medicaid",
        plan_id="OH-MEDICAID-2024",
        member_id="ODM99001",
        group_id="",
        bin="610524",
        pcn="OHMCD",
        effective_date="2022-01-01",
    )
    ci = CoverageInfo(primary=primary, secondary=secondary, cob_type="medicaid_last_resort")
    assert ci.secondary is not None
    assert ci.secondary.plan_type == "medicaid"
    assert ci.cob_type == "medicaid_last_resort"


# ── STEP 1: RxDetail sub-model ────────────────────────────────────────────────


def test_rx_detail_round_trips() -> None:
    from models.case_packet import RxDetail

    rx = RxDetail(
        drug="Ozempic (semaglutide)",
        ndc="00169-4149-11",
        dose="0.5 mg/dose",
        sig="0.5 mg subcutaneous once weekly",
        quantity=4.0,
        days_supply=28,
        refills=5,
        written_date="2024-03-14",
        pharmacy="Cigna Specialty Pharmacy Network",
    )
    restored = RxDetail.model_validate_json(rx.model_dump_json())
    assert restored.ndc == rx.ndc
    assert restored.days_supply == rx.days_supply


# ── STEP 1: LabResult sub-model ───────────────────────────────────────────────


def test_lab_result_loinc_is_optional() -> None:
    from models.case_packet import LabResult

    lab = LabResult(
        name="HbA1c",
        value="8.2",
        unit="%",
        ref_range="<5.7",
        collected_date="2024-03-14",
        abnormal_flag=True,
    )
    assert lab.loinc is None


def test_lab_result_with_loinc() -> None:
    from models.case_packet import LabResult

    lab = LabResult(
        name="HbA1c",
        loinc="4548-4",
        value="8.2",
        unit="%",
        ref_range="<5.7",
        collected_date="2024-03-14",
        abnormal_flag=True,
    )
    assert lab.loinc == "4548-4"


# ── STEP 1: PaHistoryEvent — no parallel schema ───────────────────────────────


def test_pa_history_event_is_timeline_event() -> None:
    """PaHistoryEvent must be a TypeAlias for TimelineEvent — no parallel schema."""
    from models.case_packet import PaHistoryEvent
    from models.schemas import TimelineEvent

    event = PaHistoryEvent(label="PA Submitted", date="2024-02-20", status="done")
    assert isinstance(event, TimelineEvent)


# ── STEP 1: Full CasePacket construction ──────────────────────────────────────


def test_case_packet_full_construction() -> None:
    from models.case_packet import (
        CasePacket,
        Coverage,
        CoverageInfo,
        HubClient,
        LabResult,
        RxDetail,
    )
    from models.schemas import ClientType, PatientContext, TimelineEvent

    packet = CasePacket(
        case_id="case-ozempic-001",
        hub=HubClient(
            client_id="hub-001",
            name="Acme Hub",
            type=ClientType.medtech,
            letterhead_name="Acme Hub, LLC",
        ),
        patient=PatientContext(
            patient_name="Marcus T. Halverson",
            patient_dob="1972-03-14",
            patient_sex="M",
            member_id="CGN00123456",
            group_id="GRP-78001",
            patient_address="4821 Ridgecrest Drive, Columbus, OH 43215",
            prescriber_name="Dr. Priya Ananthakrishnan, MD",
            prescriber_npi="1234567890",
            prescriber_specialty="Endocrinology",
            prescriber_address="300 Commerce Way, Columbus, OH 43214",
            prescriber_phone="(614) 555-0177",
        ),
        coverage=CoverageInfo(
            primary=Coverage(
                payer="Cigna Connect 500 PPO",
                plan_type="commercial",
                plan_id="CIGNA-CNF360-2024",
                member_id="CGN00123456",
                group_id="GRP-78001",
                bin="004336",
                pcn="CIGNA",
                effective_date="2024-01-01",
            )
        ),
        rx=RxDetail(
            drug="Ozempic (semaglutide)",
            ndc="00169-4149-11",
            dose="0.5 mg/dose",
            sig="0.5 mg SC weekly",
            quantity=4.0,
            days_supply=28,
            refills=5,
            written_date="2024-03-14",
            pharmacy="Cigna Specialty Pharmacy Network",
        ),
        labs=[
            LabResult(
                name="HbA1c",
                loinc="4548-4",
                value="8.2",
                unit="%",
                ref_range="<5.7",
                collected_date="2024-03-14",
                abnormal_flag=True,
            )
        ],
        pa_history=[
            TimelineEvent(label="PA Submitted", date="2024-02-20", status="done"),
        ],
    )
    assert packet.case_id == "case-ozempic-001"
    assert packet.coverage.primary.plan_type == "commercial"
    assert len(packet.labs) == 1
    assert packet.labs[0].abnormal_flag is True
    assert len(packet.pa_history) == 1


def test_case_packet_json_round_trip() -> None:
    from models.case_packet import CasePacket, Coverage, CoverageInfo, HubClient, RxDetail
    from models.schemas import ClientType, PatientContext

    packet = CasePacket(
        case_id="round-trip-001",
        hub=HubClient(
            client_id="hub-rt",
            name="RT Hub",
            type=ClientType.medtech,
            letterhead_name="RT Hub LLC",
        ),
        patient=PatientContext(
            patient_name="Test Patient",
            patient_dob="1990-01-01",
            patient_sex="F",
            member_id="MBR001",
            group_id="GRP-001",
            patient_address="123 Test St",
            prescriber_name="Dr. Test",
            prescriber_npi="1111111111",
            prescriber_specialty="General",
            prescriber_address="456 Medical Blvd",
            prescriber_phone="(555) 000-0000",
        ),
        coverage=CoverageInfo(
            primary=Coverage(
                payer="Test Payer",
                plan_type="commercial",
                plan_id="TEST-001",
                member_id="MBR001",
                group_id="GRP-001",
                bin="000001",
                pcn="TEST",
                effective_date="2024-01-01",
            )
        ),
        rx=RxDetail(
            drug="Test Drug",
            ndc="00000-0000-00",
            dose="1 mg",
            sig="1 mg daily",
            quantity=30.0,
            days_supply=30,
            refills=0,
            written_date="2024-01-01",
            pharmacy="Test Pharmacy",
        ),
    )
    restored = CasePacket.model_validate_json(packet.model_dump_json())
    assert restored.case_id == packet.case_id
    assert restored.coverage.primary.payer == packet.coverage.primary.payer
    assert restored.labs == []
    assert restored.pa_history == []


# ── STEP 2: Coverage pool file ────────────────────────────────────────────────


def test_coverage_pool_file_exists() -> None:
    assert _COVERAGE_POOL_PATH.exists(), f"Not found: {_COVERAGE_POOL_PATH}"


def test_coverage_pool_is_valid_json() -> None:
    raw = _COVERAGE_POOL_PATH.read_text(encoding="utf-8")
    json.loads(raw)


# ── STEP 2: Coverage pool loader ──────────────────────────────────────────────


def test_coverage_pool_module_importable() -> None:
    from golden_set.coverages import get_coverage, load_coverage_pool  # noqa: F401


def test_coverage_pool_loads_all_anchors() -> None:
    from golden_set.coverages import load_coverage_pool

    records = load_coverage_pool()
    found = {r.anchor_id for r in records}
    assert _ALL_ANCHOR_IDS == found


def test_get_coverage_returns_coverage_info() -> None:
    from golden_set.coverages import get_coverage
    from models.case_packet import CoverageInfo

    ci = get_coverage("ozempic_cigna")
    assert isinstance(ci, CoverageInfo)


def test_ozempic_primary_is_cigna_commercial() -> None:
    from golden_set.coverages import get_coverage

    ci = get_coverage("ozempic_cigna")
    assert ci.primary.payer == "Cigna Connect 500 PPO"
    assert ci.primary.plan_type == "commercial"
    assert ci.primary.plan_id == "CIGNA-CNF360-2024"


def test_ozempic_secondary_is_medicaid() -> None:
    """COB rule: Medicaid is statutory payer of last resort — always secondary."""
    from golden_set.coverages import get_coverage

    ci = get_coverage("ozempic_cigna")
    assert ci.secondary is not None, "ozempic_cigna must have Medicaid secondary coverage"
    assert ci.secondary.plan_type == "medicaid"
    assert ci.cob_type == "medicaid_last_resort"


def test_livdelzi_primary_is_cigna_commercial() -> None:
    from golden_set.coverages import get_coverage

    ci = get_coverage("livdelzi_cigna_hepatology")
    assert ci.primary.payer == "Cigna Connect 500 PPO"
    assert ci.primary.plan_type == "commercial"
    assert ci.primary.plan_id == "CIGNA-CNF877-2024"


def test_livdelzi_secondary_is_commercial_spouse() -> None:
    """Birthday-rule COB: Cigna primary + commercial secondary (spouse plan)."""
    from golden_set.coverages import get_coverage

    ci = get_coverage("livdelzi_cigna_hepatology")
    assert ci.secondary is not None, "livdelzi_cigna must have commercial secondary (spouse)"
    assert ci.secondary.plan_type == "commercial"
    assert ci.cob_type == "birthday_rule"


def test_esomeprazole_has_no_secondary() -> None:
    """Baseline single-payer scenario — no COB."""
    from golden_set.coverages import get_coverage

    ci = get_coverage("esomeprazole_uhc_pediatric")
    assert ci.secondary is None
    assert ci.cob_type is None


def test_all_anchors_have_financials() -> None:
    from golden_set.coverages import get_coverage

    for anchor_id in _ALL_ANCHOR_IDS:
        ci = get_coverage(anchor_id)
        assert ci.financials is not None, f"{anchor_id}: financials is None"
        assert ci.financials.deductible >= 0
        assert ci.financials.oop_max >= ci.financials.deductible


def test_get_coverage_raises_for_unknown_anchor() -> None:
    from golden_set.coverages import get_coverage

    with pytest.raises(KeyError, match="no_such_anchor"):
        get_coverage("no_such_anchor")


# ── STEP 7: Closed-pool allowlists ────────────────────────────────────────────


def test_pool_coverage_member_ids_non_empty() -> None:
    from golden_set.coverages import POOL_COVERAGE_MEMBER_IDS

    assert len(POOL_COVERAGE_MEMBER_IDS) >= 3


def test_pool_bins_non_empty() -> None:
    from golden_set.coverages import POOL_BINS

    assert len(POOL_BINS) >= 1


def test_pool_pcns_non_empty() -> None:
    from golden_set.coverages import POOL_PCNS

    assert len(POOL_PCNS) >= 1


def test_all_primary_member_ids_in_coverage_allowlist() -> None:
    from golden_set.coverages import POOL_COVERAGE_MEMBER_IDS, load_coverage_pool

    for rec in load_coverage_pool():
        assert rec.primary.member_id in POOL_COVERAGE_MEMBER_IDS, (
            f"anchor={rec.anchor_id}: primary member_id {rec.primary.member_id!r} "
            "not in POOL_COVERAGE_MEMBER_IDS"
        )


def test_all_secondary_member_ids_in_coverage_allowlist() -> None:
    from golden_set.coverages import POOL_COVERAGE_MEMBER_IDS, load_coverage_pool

    for rec in load_coverage_pool():
        if rec.secondary:
            assert rec.secondary.member_id in POOL_COVERAGE_MEMBER_IDS, (
                f"anchor={rec.anchor_id}: secondary member_id "
                f"{rec.secondary.member_id!r} not in POOL_COVERAGE_MEMBER_IDS"
            )


def test_secondary_member_ids_not_in_identity_pool() -> None:
    """Secondary-payer member IDs live exclusively in the coverage pool allowlist,
    not in identities.json (which tracks primary-payer IDs only)."""
    from golden_set.coverages import load_coverage_pool
    from golden_set.identities import POOL_MEMBER_IDS

    for rec in load_coverage_pool():
        if rec.secondary:
            assert rec.secondary.member_id not in POOL_MEMBER_IDS, (
                f"anchor={rec.anchor_id}: secondary member_id "
                f"{rec.secondary.member_id!r} must NOT be in identity POOL_MEMBER_IDS"
            )


def test_all_bins_in_allowlist() -> None:
    from golden_set.coverages import POOL_BINS, load_coverage_pool

    for rec in load_coverage_pool():
        assert rec.primary.bin in POOL_BINS, (
            f"anchor={rec.anchor_id}: primary BIN {rec.primary.bin!r} not in POOL_BINS"
        )
        if rec.secondary:
            assert rec.secondary.bin in POOL_BINS, (
                f"anchor={rec.anchor_id}: secondary BIN {rec.secondary.bin!r} not in POOL_BINS"
            )


def test_all_pcns_in_allowlist() -> None:
    from golden_set.coverages import POOL_PCNS, load_coverage_pool

    for rec in load_coverage_pool():
        assert rec.primary.pcn in POOL_PCNS, (
            f"anchor={rec.anchor_id}: primary PCN {rec.primary.pcn!r} not in POOL_PCNS"
        )
        if rec.secondary:
            assert rec.secondary.pcn in POOL_PCNS, (
                f"anchor={rec.anchor_id}: secondary PCN {rec.secondary.pcn!r} not in POOL_PCNS"
            )
