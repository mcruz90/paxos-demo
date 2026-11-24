"""A test-only profile exercises the generic generator conflict template."""

from golden_set.documents import generate_documents
from golden_set.seeds import SEEDS, CriterionSpec, ScenarioProfile


def test_synthetic_conflict_profile_cites_both_claims():
    criterion = CriterionSpec(
        "test_conflict",
        "Test observation",
        "custom",
        "conflict",
        conflict_claim_1="Test observation present.",
        conflict_claim_2="Test observation absent.",
    )
    profile = ScenarioProfile("test_only_conflict", (criterion,))
    (snippet,) = generate_documents(SEEDS["ozempic_cigna"], profile).clinical_snippets
    assert f"Source 1: {criterion.conflict_claim_1}" in snippet
    assert f"Source 2: {criterion.conflict_claim_2}" in snippet
