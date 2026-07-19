"""security/tenancy.py — the fail-closed tenant scope for read paths (ADR-0017).

Beside ``sessions.py``: a session carries *who* the caller is; a
:class:`TenancyScope` carries *what they may see*. Two provenances, matching
the dual-auth model (ADR-0013):

* a cookie session resolves to a **tenant scope** (``for_tenant`` with the
  session's ``tenant_id`` claim) — sees only that tenant's rows;
* a Bearer / service caller resolves to a **platform scope** (``platform``) —
  service calls are platform-plane and see everything (ADR-0017 point 2). They
  must never return rehydrated PHI anyway.

The scoping rule :func:`record_in_scope` is a pure function (tenant-id string in,
bool out) so it is unit-testable with literal inputs and no store (CLAUDE.md
business-logic rule). The audit-store read path applies it; ``TenancyScope`` is
a required argument there so a future read path cannot forget the filter — no
scope, no rows (ADR-0017 point 3, the detection-pairs-with-enforcement rule
applied to read access).

Pre-DB this is a discipline/type seam: a single seeded tenant means demo/live
behavior is unchanged. At the Phase 3 durable store only the claim *source*
changes (session mint → IdP); the scope type, the rule, and the call sites
carry over (ADR-0017 Q4).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TenancyScope:
    """What a caller may read. Build it through the two factories, never the
    raw constructor, so the platform/tenant intent is explicit at the call site.

    ``tenant_id`` is the single tenant a tenant-plane caller may see; it is
    ``None`` for a platform-plane caller (and for the fail-closed default a
    caller with no resolved tenant lands on).
    """

    tenant_id: str | None
    is_platform: bool = False

    @classmethod
    def for_tenant(cls, tenant_id: str | None) -> TenancyScope:
        """A tenant-plane scope: sees only ``tenant_id``'s rows. ``None`` ⇒ the
        fail-closed default (matches no row) — a caller whose tenant could not
        be resolved sees nothing rather than everything."""
        return cls(tenant_id=tenant_id, is_platform=False)

    @classmethod
    def platform(cls) -> TenancyScope:
        """A platform-plane scope (Bearer / service caller): sees every tenant."""
        return cls(tenant_id=None, is_platform=True)


def record_in_scope(record_tenant_id: str, scope: TenancyScope) -> bool:
    """Pure scoping rule: may *scope* see a row owned by *record_tenant_id*?

    Platform scope sees every tenant; a tenant scope sees only its own tenant;
    a tenant scope with no resolved tenant sees nothing (fail-closed).
    """
    if scope.is_platform:
        return True
    if scope.tenant_id is None:
        return False
    return record_tenant_id == scope.tenant_id
