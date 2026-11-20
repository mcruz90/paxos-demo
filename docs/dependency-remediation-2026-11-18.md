# Dependency security remediation — November 18, 2026

The required OSV-backed pip-audit run flagged nine package versions already in
the b635170 backend lockfile. This increment updates those exact versions and
does not add/remove package names, change providers, or enable tracing.

| Package | Previous | Selected |
|---|---|---|
| anyio | 4.14.0 | 4.14.2 |
| certifi | 2026.6.17 | 2026.10.23 |
| filelock | 3.29.4 | 4.2.1 |
| langgraph | 1.2.7 | 1.2.14 |
| langgraph-sdk | 0.4.2 | 0.4.6 |
| msgpack | 1.2.1 | 1.2.3 |
| pillow | 12.2.0 | 13.0.0 |
| pip | 26.1.2 | 26.2 |
| urllib3 | 2.7.0 | 2.8.0 |

## Baseline advisory evidence

These are representative IDs actually present in the failed baseline audit for
each old version, not advisories against the selected fixed versions. The hand-over
includes the original audit and a complete deduplicated advisory map with reported
fix versions; Pillow/Filelock and other rows have additional findings.

| Affected baseline package | Representative finding |
|---|---|
| anyio 4.14.0 | [GHSA-3w57-8xmc-8v26](https://osv.dev/vulnerability/GHSA-3w57-8xmc-8v26) |
| certifi 2026.6.17 | [GHSA-6q48-6c7w-9gw2](https://osv.dev/vulnerability/GHSA-6q48-6c7w-9gw2) |
| filelock 3.29.4 | [GHSA-567q-5qvw-pf92](https://osv.dev/vulnerability/GHSA-567q-5qvw-pf92) |
| langgraph 1.2.7 | [GHSA-3fx2-cqw9-xr3c](https://osv.dev/vulnerability/GHSA-3fx2-cqw9-xr3c) |
| langgraph-sdk 0.4.2 | [GHSA-fvww-7h3r-vfhp](https://osv.dev/vulnerability/GHSA-fvww-7h3r-vfhp) |
| msgpack 1.2.1 | [GHSA-j586-36cw-2gc2](https://osv.dev/vulnerability/GHSA-j586-36cw-2gc2) |
| pillow 12.2.0 | [GHSA-27h8-gf7j-v5hc](https://osv.dev/vulnerability/GHSA-27h8-gf7j-v5hc) |
| pip 26.1.2 | [GHSA-qwm4-qh6w-59xr](https://osv.dev/vulnerability/GHSA-qwm4-qh6w-59xr) |
| urllib3 2.7.0 | [GHSA-8988-9cw3-xx77](https://osv.dev/vulnerability/GHSA-8988-9cw3-xx77) |

PyPI metadata for each selected exact version was checked for canonical project
identity, release age and yanking; OSV and PyPI advisory responses were empty.
All are over seven days old. Upstream advisory/release and malware/supply-chain
searches were reviewed; these checks do not guarantee absence of undisclosed
vulnerabilities. Certifi uses the later October trust-store update rather than
the earliest reported fix. Filelock and Pillow are major-version changes and
require regression coverage.

Installed metadata identifies CacheControl's filecache extra as Filelock's
consumer (used by pip-audit's HTTP cache). A targeted test exercises the actual
FileCache and FileLock implementations: round-trip writes, blocked writes under
a held lock with a bounded timeout, unchanged content on contention, and a new
cache instance writing successfully after release. No lock implementation is mocked.

The [Filelock changelog](https://github.com/tox-dev/filelock/blob/main/docs/changelog.rst),
including 4.0.0 migration notes, was reviewed. SoftReadWriteLock changed its on-disk
protocol; old and new participants must not share that protocol during rollout.
The identified CacheControl consumer uses FileLock, not SoftReadWriteLock. This
increment tests that actual consumer path and uses an isolated environment; it
does not claim compatibility for every Filelock API. Use a dedicated audit cache,
and do not mix old/new consumers concurrently on shared lock paths.

Direct LangGraph/urllib3/Pillow requirements are exact pins. Existing direct core/checkpoint bounds now match LangGraph requirements (core>=1.4.7,<2; checkpoint>=4.1,<5), with no change to their resolved versions. Other fixes are uv
constraint-dependencies so existing transitive dependencies are governed without
making unused packages direct runtime requirements. The lock was resolved and
installed using uv 0.12.24. Its format revision and artifact upload metadata changed;
only the nine listed package versions changed. No dependency was suppressed.

Validation on Python 3.13.5 with mock generation and tracing disabled:

- Full OSV-backed pip-audit: 84 packages, no known vulnerabilities reported.
- Full backend suite: 636 passed; one existing Starlette/httpx deprecation warning.
- Mypy: 149 source files clean; source lint and added-test formatting clean.
- New synthetic PNG/JPEG/TIFF tests exercise actual Pillow decoding in the application ETL;
  OCR is replaced at the boundary and no model is run.
- The first full run had 632 passes and one telemetry-subprocess timeout under
  concurrent validation. The unchanged telemetry test passed alone, then all
  634 tests passed in a sequential rerun. No timeout/assertion was weakened.

The security RED check is the baseline audit failure; the compatibility test is
not an exploit reproduction and is not claimed to fail on the old library. This
increment does not fix known application clinical/workflow defects, update the
Python interpreter/OS, certify image/native libraries, or establish browser or
clinical validation. No real models, held-out evaluation, deployment or live
service restart is part of this change.

Primary metadata sources: [PyPI](https://pypi.org/), [OSV](https://osv.dev/), and the
projects linked from each package's verified registry metadata. Detailed query
receipts and tests are in the accompanying Codex hand-over artifacts.


