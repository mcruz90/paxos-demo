# Third-Party Notices

## Fight Health Insurance

Portions of this software are derived from **Fight Health Insurance**
(https://github.com/fighthealthinsurance/fighthealthinsurance).

Copyright (c) Fight Health Insurance contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use these files except in compliance with the License.
A copy of the License is provided in `THIRD_PARTY_LICENSES/Apache-2.0.txt`.

### Forked files

The following files under `third_party/fhi/` originate from the
Fight Health Insurance repository. Each file preserves its original
copyright header. Files marked "adapted" have had Django ORM
dependencies removed; a change summary appears at the top of each
modified file.

| File | Status | Changes |
|---|---|---|
| `third_party/fhi/denial_base.py` | Forked verbatim | None |
| `third_party/fhi/prompt_templates.py` | Forked + adapted | Replaced Django `ChatType` model import with inline enum |
| `third_party/fhi/generate_appeal.py` | Forked + adapted | Replaced `InsuranceCompany.objects` DB query with injected `company_names: list[str]` param; removed `sync_to_async` |
| `third_party/fhi/medical_code_extractor.py` | Forked verbatim | None |
| `third_party/fhi/field_confidence.py` | Forked verbatim | None |
