"""etl/pas_rail — outbound PAS rail adapter (initial-PA transmission).

Rail-accurate per docs/architecture/05-state-lifecycle.md: the PAS rail
carries initial prior-auth requests only; appeals ride the appeal channel
and never touch this package.
"""
