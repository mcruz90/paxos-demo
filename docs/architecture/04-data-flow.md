# 04 — Data Flow & Trust Boundaries

*Verified against source 2026-07-02 (branch `project-review-hardening`).*

Two flows matter: the **live appeal-generation path** (untrusted document in,
gatekept letter out) and the **golden-set supply chain** (how canonical data
reaches retrieval, tests, evals, and the demo UI).

## Flow 1 — Appeal generation (live path)

```mermaid
flowchart TB
    subgraph untrusted ["UNTRUSTED ZONE — attacker-controllable input"]
        doc["Denial letter bytes<br/>(PDF / image / text, ≤ 5 MB)"]
    end

    subgraph etlz ["ETL — etl/denial_letter/pipeline.py"]
        detect["file_detector.detect()<br/>magic bytes, NOT filename<br/>rejects MZ / ELF / ZIP"]
        extract["Text extraction<br/>PyMuPDF (pdf) · pytesseract (image) · utf-8 (text)"]
        sanitize["sanitize_extracted_text()<br/>null bytes · bidi · zero-width ·<br/>homoglyphs · injection phrases"]
        phantom["ocr_consistency_check()<br/>white-fill + text-draw in PDF stream;<br/>unreadable page ⇒ flagged (hard-6)"]
        fields["Regex field extraction<br/>drug · diagnosis · denial_reason ·<br/>plan · plan_id · ICD codes (≤5)"]
        req["AppealRequest<br/>(strict Pydantic; security_hold if flagged)"]
    end

    subgraph pipeline ["Pipeline — agents/graph.py"]
        hold{"security_hold?"}
        ing["ingestion → PipelineState"]
        ret["retrieval → pa_context, pa_resolution"]
        prompt["build_prompt()<br/>untrusted text ONLY inside<br/>&lt;pa_requirements&gt; / &lt;denial_letter&gt; XML slots"]
        llm["LLMBackend.generate_stream()"]
        gate["gatekeeper (deterministic)"]
        score["eval_structural (deterministic)"]
    end

    sse["SSE stream: step / chunk / done / error"]
    err["ErrorEvent — LLM never invoked"]
    pareq[("data/pa_requirements.json")]

    doc --> detect --> extract --> sanitize --> fields --> req
    doc --> phantom --> req
    req --> hold
    hold -- yes --> err
    hold -- no --> ing --> ret --> prompt --> llm --> gate
    ret --- pareq
    gate -- "pass" --> score --> sse
    gate -- "fail < 3×" --> prompt
    gate -- "fail 3×" --> sse
```

### Trust boundaries on this path

| # | Boundary | Control | Where |
| --- | --- | --- | --- |
| 1 | Bytes → typed file | Magic-byte detection, executable rejection, 5 MB cap, empty-input rejection | [file_detector.py](../../backend/etl/denial_letter/file_detector.py), [pipeline.py](../../backend/etl/denial_letter/pipeline.py) |
| 2 | Extracted text → clean text | Sanitization + PhantomLint hidden-text check; anything suspicious sets `security_hold` | [sanitize.py](../../backend/security/sanitize.py) |
| 3 | Request → pipeline | Strict Pydantic validation at HTTP boundary; security-hold gate before any node (hard-1) | [schemas.py](../../backend/models/schemas.py), [graph.py](../../backend/agents/graph.py) |
| 4 | Untrusted text → prompt | XML-delimited slots only — never raw interpolation | [prompts.py](../../backend/agents/prompts.py), [synthesis.py](../../backend/agents/nodes/synthesis.py) |
| 5 | LLM output → downstream | Deterministic gatekeeper before any use ([ADR-0003](adr/0003-deterministic-gatekeeper.md)) | [gatekeeper.py](../../backend/agents/nodes/gatekeeper.py) |
| 6 | Anything → logs/traces | `redact_phi()` before any external sink; pipeline logs identifiers only | [redact.py](../../backend/security/redact.py) |

The full threat analysis lives in
[07-security-architecture.md](07-security-architecture.md).

**Gap to know about:** the ETL is currently a library
(`process_denial_letter(raw_bytes, filename)`) — no upload HTTP route exists
yet. When one is added it inherits the pipeline-level security-hold gate, but
must add its own auth + upload limits (see
[10-roadmap-traceability.md](10-roadmap-traceability.md)).

## Flow 2 — Golden-set supply chain

One canonical dataset feeds everything; adapters translate, nothing is
hand-duplicated (CLAUDE.md DRY; governance in
[/docs/golden-set-governance.md](../golden-set-governance.md)).

```mermaid
flowchart TB
    subgraph sources ["Sourced + provenance-tracked — backend/golden/"]
        policies["policies/*.md<br/>(+ _raw/ originals, provenance.json w/ SHA256)"]
        procedures["payer_procedures/*.json"]
        regulatory["regulatory/rules.json"]
        identities["identities.json (IDENTITY_POOL)<br/>coverage_pool.json (S5 hook)"]
    end

    gen["golden_set/generate.py<br/>synthetic denial letters + clinical docs"]

    fixture["evals/fixtures/scenarios.json<br/>6 scenarios / 3 anchors<br/>(EvalScenario schema)"]

    adapter["evals/fixtures_adapter.py"]

    subgraph consumers ["Consumers"]
        pareq2["data/pa_requirements.json<br/>(retrieval packs — seeded from fixtures)"]
        tests["backend/tests/* via conftest fixtures"]
        evalrun["evals/eval_structural + future run_evals.py"]
        fescn["src/data/scenarios.tsx<br/>(demo UI scenarios)"]
    end

    guard["Parity guards:<br/>scenarios_parity.test.ts · test_schema_parity.py ·<br/>test_golden_compliance.py (CI gate)"]

    policies --> gen
    identities --> gen
    gen --> fixture
    procedures --> fixture
    regulatory --> fixture
    fixture --> adapter
    adapter --> tests
    adapter --> evalrun
    fixture --> pareq2
    fixture -. "mirrored by hand,<br/>drift-gated" .-> fescn
    fescn --- guard
    pareq2 --- guard
```

### Retrieval resolution (where Flow 2 meets Flow 1)

[retrieval.py](../../backend/agents/nodes/retrieval.py) loads
`data/pa_requirements.json` **once at module import** (validated pack-by-pack;
malformed packs raise `ETLParseError`), building two lookup tables:

1. `plan_id` → criteria_text — exact match, most specific (`pa_resolution="plan_id"`)
2. drug alias (lowercased) → criteria_text — substring match on the request's drug (`pa_resolution="drug_alias"`)
3. neither → generic boilerplate (`pa_resolution="generic"`) — never raises

The fired path travels through `PipelineState.pa_resolution` to
`DoneEvent.pa_resolution` so the audit trail can distinguish a payer-specific
letter from a generic-fallback one (hard-5). Sprint 5 extends resolution to
BIN/PCN/Group + market + tier via `golden/coverage_pool.json`.
