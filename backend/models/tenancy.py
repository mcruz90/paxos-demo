"""Tenancy vocabulary — the seeded pre-DB tenant id (ADR-0017).

Base layer of the ``models/`` package (no intra-package imports), so
``requests.py`` and ``audit.py`` can both default their ``tenant_id`` to this
constant without an import cycle, and up-layer code (``security/tenancy.py``,
the session mint) can import the same single source. Re-exported through
``models.schemas`` — import from there, not from here.

Pre-DB, every case-bearing object (the request models + ``AuditRecord``) rides
a single seeded tenant so the demo / live shell behavior is unchanged
(ADR-0017 point 5, Q3). Real multi-tenant data waits for the Phase 3 durable
store; at that point only the claim *source* changes (session mint → IdP) —
this default is what the discipline seam carries until then.
"""

from __future__ import annotations

# The one seeded customer org the pre-DB stores ride on. Every request/audit
# default and the login session mint resolve to this until the durable store.
SEEDED_TENANT_ID = "tenant_demo"
