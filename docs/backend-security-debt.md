# Backend Security & Correctness Debt

Identified during code review of the `demo` branch (2026-06-25). The demo branch
carries a skeleton backend — these issues should be addressed before the `main`
branch backend is hardened for production use.

---

## 1. `sanitized.suspicious` flag never read after sanitization

**File:** `backend/etl/denial_letter/pipeline.py:125`

`sanitize_extracted_text()` returns a `SanitizeResult` with a `suspicious` flag
and a `reason` string. The ETL pipeline reads only `.clean_text` and discards the
flag entirely. Any document flagged as suspicious (bidi override chars, homoglyph
substitution, injection phrases) is ingested identically to a clean document — no
security hold is raised, no quarantine path fires.

**Fix:** Check `sanitized.suspicious` after line 125. If `True`, set
`security_hold = True` and `security_reason = sanitized.reason` rather than
running the PDF-only `_check_security_hold` in isolation.

---

## 2. Injection pattern scan skipped when bidi chars also present

**File:** `backend/security/sanitize.py:123`

The `if not suspicious:` guard at line 123 means injection pattern scanning is
skipped entirely once `suspicious` is already `True` (e.g. from bidi override
detection). A combined bidi + injection attack (use U+202E to trigger the bidi
path, embed `ignore all previous instructions` in the same document) bypasses the
injection scanner. The `reason` field records only `"bidi override characters
detected"`, with no mention of the injection phrase.

**Fix:** Remove the `if not suspicious:` guard so injection patterns are always
checked. Accumulate both reasons: `reason = "; ".join(filter(None, [reason,
injection_reason]))`.

---

## 3. Timing side-channel on Bearer token comparison

**File:** `backend/main.py:61`

`token != secret` is a plain Python string comparison that short-circuits at the
first differing byte. An attacker co-located with the server can recover the
`API_SECRET_KEY` character by character via timing differences across many
requests.

**Fix:** Replace with `hmac.compare_digest(token, secret)` (constant time).
Requires `import hmac` at the top of the file.

---

## 4. PHI written to disk via NamedTemporaryFile unnecessarily

**File:** `backend/etl/denial_letter/pipeline.py:84`

`_check_security_hold` writes the raw PDF bytes (PHI) to a
`NamedTemporaryFile(delete=False)` solely to produce a `pathlib.Path` for
`ocr_consistency_check()`. A crash between the write and the `finally` cleanup
orphans PHI on the host filesystem.

**Fix:** Refactor `ocr_consistency_check(pdf_path: Path)` to accept
`bytes` directly and use `fitz.open(stream=raw_bytes, filetype="pdf")` — the
same pattern already used in `_extract_text_from_bytes`. Eliminates the disk
write entirely.

---

## 5. Bare `except Exception` swallows `eval_structural` failures silently

**File:** `backend/agents/graph.py:74-77`

```python
try:
    scores = eval_structural(full_text, request)
except Exception:
    scores = {}
```

Any bug in `eval_structural` (e.g. `AttributeError` from a schema change) is
silently swallowed. `DoneEvent` emits `structural_scores={}`, which is
indistinguishable in the audit record from a genuine run that scored zero.

**Fix:** At minimum log the exception before swallowing it:
`except Exception as e: logger.warning("eval_structural failed: %s", e); scores = {}`.
Longer term, only catch specific expected exceptions.

---

## 6. Regex patterns compiled inside per-page loop

**File:** `backend/security/sanitize.py:164`

`_WHITE_FILL_RE` and `_TEXT_SHOW_RE` are defined with `re.compile()` inside the
`for page_num in range(len(doc)):` loop body in `ocr_consistency_check()`. They
are recompiled on every page of every PDF. All other regex constants in this file
are module-level.

**Fix:** Move both patterns to module level alongside `_ZERO_WIDTH_RE`,
`_BIDI_RE`, and `_INJECTION_PATTERNS`.
