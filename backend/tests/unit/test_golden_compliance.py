"""Corpus-wide compliance scan — Phase 0.E. No LLM, no network.

SCOPE (cross-cutting; does NOT duplicate component tests listed below):
  1. SYNTHETIC marker present in the canonical scenarios fixture
  2. PII membership — DOB and NPI tokens in non-redteam scenarios are pool-sourced
  3. Public policy + payer-procedure docs: no pool patient identifiers
  4. Policy provenance: authored anchors have required hash fields + terms
  5. No dangling policy_refs or appeal_process_refs — every scenario ref resolves
  6. redact_phi() scrubs pool prescriber names and pool DOBs from corpus text

NOT DUPLICATED here (see component tests):
  - test_regulatory_rules.py  : rule_ids, quote/source_url/authority, no dangling rule_refs
  - test_adversarial_fixtures.py: redteam markers, injection/PHI defensive behavior
  - test_golden_generator.py  : SYNTHETIC_MARKER in generated docs, pool identity membership
  - test_scenarios_fixture.py : scenarios.json schema, required IDs, structural invariants
  - test_golden_fetcher.py    : fetcher, provenance model round-trip
  - test_phi_redact.py        : unit tests for redact_phi() with generic inputs

NOTE — middle-initial patient names:
  Pool patient names ("Marcus T. Halverson", "Jordan R. Peterman", "Diane K. Rourke")
  contain middle initials, which the current two-word regex in redact_phi() does not
  catch.  That is a known redact.py limitation tracked in docs/backend-security-debt.md.
  This test covers PRESCRIBER names (no middle initial in the two-word portion) and
  DOBs (which the MM/DD/YYYY pattern catches unconditionally).

Run from backend/:
    uv run pytest tests/unit/test_golden_compliance.py -v
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from golden_set.coverages import POOL_COVERAGE_MEMBER_IDS
from golden_set.identities import IDENTITY_POOL, POOL_DOBS, POOL_MEMBER_IDS, POOL_NPIS
from golden_set.markers import SYNTHETIC_MARKER

# ---------------------------------------------------------------------------
# Corpus paths
# ---------------------------------------------------------------------------

_BACKEND = Path(__file__).parent.parent.parent          # backend/
_GOLDEN = _BACKEND / "golden"
_POLICY_DIR = _GOLDEN / "policies"
_RAW_DIR = _POLICY_DIR / "_raw"
_PAYER_PROC_DIR = _GOLDEN / "payer_procedures"
_SCENARIOS_PATH = _BACKEND / "evals" / "fixtures" / "scenarios.json"

# Anchors whose .md files were human-authored (not reference-only stubs)
_AUTHORED_ANCHOR_IDS: frozenset[str] = frozenset({
    "ozempic_cigna",
    "esomeprazole_uhc_pediatric",
    "livdelzi_cigna_hepatology",
    "humira_cigna",
})

# Combined pool of all patient-scope identifiers that must never appear in public docs
_ALL_POOL_MEMBER_IDS: frozenset[str] = POOL_MEMBER_IDS | POOL_COVERAGE_MEMBER_IDS
_ALL_POOL_NPIS: frozenset[str] = POOL_NPIS

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_scenarios_raw() -> dict:
    return json.loads(_SCENARIOS_PATH.read_text(encoding="utf-8"))


def _non_redteam_scenarios(data: dict) -> list[dict]:
    return [s for s in data["scenarios"] if s.get("denial_type") != "redteam"]


def _known_procedure_ids() -> set[str]:
    ids: set[str] = set()
    for f in _PAYER_PROC_DIR.glob("*.json"):
        try:
            proc = json.loads(f.read_text(encoding="utf-8"))
            if "procedure_id" in proc:
                ids.add(proc["procedure_id"])
        except json.JSONDecodeError:
            pass
    return ids


def _known_policy_refs() -> set[str]:
    """anchor_ids from provenance.json + .md stems in policies/."""
    prov = json.loads((_POLICY_DIR / "provenance.json").read_text(encoding="utf-8"))
    anchor_ids = {r["anchor_id"] for r in prov["records"]}
    md_stems = {f.stem for f in _POLICY_DIR.glob("*.md")}
    return anchor_ids | md_stems


# ===========================================================================
# 1. SYNTHETIC marker in canonical fixture
# ===========================================================================


def test_scenarios_fixture_carries_synthetic_marker() -> None:
    """scenarios.json must carry SYNTHETIC_MARKER as the corpus-origin label.

    RED guard: fails until the marker is added to the fixture's _note or a
    dedicated data_classification field.  Every synthetic fixture must be
    unambiguously labelled so an automated scan can distinguish synthetic
    corpus files from real patient data.
    """
    text = _SCENARIOS_PATH.read_text(encoding="utf-8")
    assert SYNTHETIC_MARKER in text, (
        f"{_SCENARIOS_PATH.name} does not contain SYNTHETIC_MARKER={SYNTHETIC_MARKER!r}. "
        "Add the marker to the _note field (prefix: 'SYNTHETIC — NO PHI — ...')."
    )


# ===========================================================================
# 2. PII membership — non-redteam scenarios
# ===========================================================================

# Pool DOBs converted from YYYY-MM-DD → MM/DD/YYYY for comparison against
# the evidence_summary strings where they appear as "DOB MM/DD/YYYY".
_POOL_DOBS_MDY: frozenset[str] = frozenset(
    f"{d[5:7]}/{d[8:10]}/{d[:4]}" for d in POOL_DOBS
)

_DOB_RE = re.compile(r"DOB (\d{2}/\d{2}/\d{4})")
_NPI_RE = re.compile(r"NPI (\d{10})")


def test_non_redteam_scenario_dobs_are_pool_sourced() -> None:
    """DOB strings in non-redteam evidence_summary must be declared pool DOBs.

    Checks the 'DOB MM/DD/YYYY' pattern only (not bare service dates like
    '03/14/2024'), so clinical dates survive without false positives.
    """
    data = _load_scenarios_raw()
    violations: list[str] = []

    for scenario in _non_redteam_scenarios(data):
        for crit in scenario.get("criteria", []):
            for m in _DOB_RE.finditer(crit.get("evidence_summary", "")):
                dob = m.group(1)
                if dob not in _POOL_DOBS_MDY:
                    violations.append(
                        f"scenario={scenario['scenario_id']!r} "
                        f"criterion={crit['key']!r}: "
                        f"DOB={dob!r} is not in the declared identity pool"
                    )

    assert not violations, "Non-pool DOBs found in corpus:\n" + "\n".join(violations)


def test_non_redteam_scenario_npis_are_pool_sourced() -> None:
    """NPI strings (pattern 'NPI XXXXXXXXXX') in non-redteam evidence_summary
    must be declared pool NPIs.
    """
    data = _load_scenarios_raw()
    violations: list[str] = []

    for scenario in _non_redteam_scenarios(data):
        for crit in scenario.get("criteria", []):
            for m in _NPI_RE.finditer(crit.get("evidence_summary", "")):
                npi = m.group(1)
                if npi not in _ALL_POOL_NPIS:
                    violations.append(
                        f"scenario={scenario['scenario_id']!r} "
                        f"criterion={crit['key']!r}: "
                        f"NPI={npi!r} is not in the declared identity pool "
                        f"(known: {sorted(_ALL_POOL_NPIS)})"
                    )

    assert not violations, "Non-pool NPIs found in corpus:\n" + "\n".join(violations)


# ===========================================================================
# 3. Public policy + payer-procedure docs: no pool patient identifiers
# ===========================================================================


@pytest.mark.parametrize("md_file", sorted(_POLICY_DIR.glob("*.md")))
def test_policy_md_free_of_pool_member_ids(md_file: Path) -> None:
    """Real payer policy .md files must not contain any pool patient member IDs."""
    text = md_file.read_text(encoding="utf-8")
    found = [mid for mid in _ALL_POOL_MEMBER_IDS if mid in text]
    assert not found, (
        f"{md_file.name} contains pool member IDs: {found}. "
        "Policy docs are sourced from public payer criteria and must be free of patient identifiers."
    )


@pytest.mark.parametrize("md_file", sorted(_POLICY_DIR.glob("*.md")))
def test_policy_md_free_of_pool_npis(md_file: Path) -> None:
    """Real payer policy .md files must not contain any pool prescriber NPIs."""
    text = md_file.read_text(encoding="utf-8")
    found = [npi for npi in _ALL_POOL_NPIS if npi in text]
    assert not found, (
        f"{md_file.name} contains pool NPIs: {found}. "
        "Policy docs must be free of patient/provider identifiers."
    )


@pytest.mark.parametrize("raw_file", sorted(_RAW_DIR.glob("*.txt")))
def test_raw_policy_file_free_of_pool_member_ids(raw_file: Path) -> None:
    """Raw policy text dumps must not contain any pool patient member IDs."""
    text = raw_file.read_text(encoding="utf-8")
    found = [mid for mid in _ALL_POOL_MEMBER_IDS if mid in text]
    assert not found, (
        f"{raw_file.name} contains pool member IDs: {found}."
    )


@pytest.mark.parametrize("proc_file", sorted(_PAYER_PROC_DIR.glob("*.json")))
def test_payer_procedure_doc_free_of_pool_identifiers(proc_file: Path) -> None:
    """Payer procedure JSON files must not contain pool patient member IDs or NPIs."""
    text = proc_file.read_text(encoding="utf-8")
    found_ids = [mid for mid in _ALL_POOL_MEMBER_IDS if mid in text]
    found_npis = [npi for npi in _ALL_POOL_NPIS if npi in text]
    violations = found_ids + found_npis
    assert not violations, (
        f"{proc_file.name} contains pool patient identifiers: {violations}."
    )


# ===========================================================================
# 4. Policy provenance completeness
# ===========================================================================


def test_authored_anchors_have_complete_provenance() -> None:
    """The 3 anchors with human-authored .md files must have raw_sha256,
    markdown_sha256, and terms in policies/provenance.json.

    Reference-only records (employer PDL, IFP) use source_pdf_sha256 instead
    and are intentionally excluded from this check.
    """
    prov_raw = json.loads((_POLICY_DIR / "provenance.json").read_text(encoding="utf-8"))
    by_anchor = {r["anchor_id"]: r for r in prov_raw["records"]}

    missing_anchors = _AUTHORED_ANCHOR_IDS - set(by_anchor)
    assert not missing_anchors, (
        f"Authored anchors missing from provenance.json: {missing_anchors}"
    )

    violations: list[str] = []
    for anchor_id in sorted(_AUTHORED_ANCHOR_IDS):
        rec = by_anchor[anchor_id]
        for field in ("source_url", "raw_sha256", "markdown_sha256", "terms"):
            if not rec.get(field, ""):
                violations.append(f"anchor_id={anchor_id!r}: required field {field!r} is empty")

    assert not violations, (
        "Incomplete provenance for authored anchors:\n" + "\n".join(violations)
    )


def test_all_policy_provenance_records_have_source_url() -> None:
    """Every record in policies/provenance.json must have a non-empty HTTPS source_url."""
    prov_raw = json.loads((_POLICY_DIR / "provenance.json").read_text(encoding="utf-8"))
    violations = [
        r["anchor_id"]
        for r in prov_raw["records"]
        if not r.get("source_url", "").startswith("http")
    ]
    assert not violations, (
        f"Policy provenance records with missing/non-HTTP source_url: {violations}"
    )


# ===========================================================================
# 5. No dangling refs — policy_refs and appeal_process_refs
# ===========================================================================


def test_scenario_policy_refs_resolve() -> None:
    """Every policy_ref in any scenario must map to a known anchor_id or .md stem.

    'Known' = anchor_ids in policies/provenance.json OR .md file stems in policies/.
    Empty policy_refs lists (e.g. redteam scenarios) are allowed.
    """
    known = _known_policy_refs()
    data = _load_scenarios_raw()
    violations: list[str] = []

    for scenario in data["scenarios"]:
        for ref in scenario.get("policy_refs", []):
            if ref not in known:
                violations.append(
                    f"scenario={scenario['scenario_id']!r}: "
                    f"policy_ref={ref!r} has no matching anchor or .md file"
                )

    assert not violations, (
        "Dangling policy_refs found:\n" + "\n".join(violations)
    )


def test_scenario_appeal_process_refs_resolve() -> None:
    """Every appeal_process_ref in any scenario must map to a payer_procedures/ file.

    RED guard: fails if a payer procedure file is missing.  Add the file to
    backend/golden/payer_procedures/ with the matching procedure_id.
    """
    known_proc_ids = _known_procedure_ids()
    data = _load_scenarios_raw()
    violations: list[str] = []

    for scenario in data["scenarios"]:
        ref = scenario.get("appeal_process_ref", "")
        if ref and ref not in known_proc_ids:
            violations.append(
                f"scenario={scenario['scenario_id']!r}: "
                f"appeal_process_ref={ref!r} has no matching file in payer_procedures/ "
                f"(known: {sorted(known_proc_ids)})"
            )

    assert not violations, (
        "Dangling appeal_process_refs:\n" + "\n".join(violations)
    )


# ===========================================================================
# 6. redact_phi() over pool prescriber names and DOBs
# ===========================================================================


def test_redact_phi_catches_pool_prescriber_names() -> None:
    """redact_phi() must scrub the two-word 'First Last' portion of every pool
    prescriber name when embedded in a realistic text snippet.

    Prescriber names follow the pattern 'Dr. FirstName LastName, MD'.
    The two-word interior (e.g. 'Priya Ananthakrishnan') matches the
    redact_phi two-word Title-Case pattern.

    NOTE: Pool *patient* names include middle initials ('Marcus T. Halverson')
    which the current two-word regex does not catch.  That limitation is tracked
    separately in docs/backend-security-debt.md and does not fail this test.
    """
    from security.redact import redact_phi

    for ident in IDENTITY_POOL:
        # Strip 'Dr. ' prefix and ', MD' suffix to get 'First Last'
        first_last = (
            ident.prescriber_name.removeprefix("Dr. ").removesuffix(", MD")
        )
        original = f"Prescriber on file: {ident.prescriber_name}"
        redacted = redact_phi(original)
        assert first_last not in redacted, (
            f"redact_phi did not scrub prescriber name {first_last!r} from "
            f"text: {original!r} → {redacted!r}"
        )


def test_redact_phi_catches_pool_dobs() -> None:
    """redact_phi() must scrub every pool patient DOB when presented in MM/DD/YYYY format."""
    from security.redact import redact_phi

    for ident in IDENTITY_POOL:
        # Convert YYYY-MM-DD → MM/DD/YYYY
        iso = ident.patient_dob
        dob_mdy = f"{iso[5:7]}/{iso[8:10]}/{iso[:4]}"
        original = f"Patient DOB: {dob_mdy} was seen on this date."
        redacted = redact_phi(original)
        assert dob_mdy not in redacted, (
            f"redact_phi did not scrub DOB={dob_mdy!r} from: {original!r} → {redacted!r}"
        )
