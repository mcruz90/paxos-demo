# PostgreSQL foundation draft — PR B, not part of contract increment

Before persistence code: construct/reconstruct validated records with model_validate
and revalidate changes with model_validate(record.model_dump() | changes). Do not
use model_copy(update=...) for writes or row rehydration: it bypasses cross-field
validators even for frozen models. Verify stored canonical body/digests on load;
SourceVersion validates shape and patient association, not body/digest equality.
Defensive checks in prepare_attachment remain intentional protection against
invalid internal objects; they do not replace database constraints.

## Dedicated local database setup

`compose.integration-db.yaml` names project clearauth-codex-20261117-01a1eafc;
service postgres and volume pgdata inherit that project prefix. It uses the official
PostgreSQL 18.7 bookworm image. The image's PostgreSQL 18 data layout requires
mounting /var/lib/postgresql, per the [official image documentation](https://hub.docker.com/_/postgres).
Record its resolved image digest before reporting database execution evidence.

The host database endpoint is 127.0.0.1:55432, bound to IPv4 loopback only.
Database URLs must explicitly select this endpoint; there is no default URL.
Frontend URLs and CORS origins continue to use localhost. The initialization password is read from an ignored
`.integration-db/password` file through a Docker secret, never from source code.
The clearauth initialization user has local database administration rights; this
configuration is for isolated synthetic development, not deployment credentials.

Before first start, inspect existing project/volume ownership and port usage.
Do not adopt or delete an existing resource on collision. Never run down with
volume removal. Restart/recreate tests must preserve this named volume. Starting
the container does not create application tables. The explicit migration command,
not application startup, applies source-controlled SQL.

The official image was checked against Docker Hub tag metadata and docker-library
repo-info on November 18. Index digest:
sha256:ece55f7868da684e400f82f1030a050718adbdd65c23aa500c486f6e2950dc0f.
Tag publication: 2026-11-12T22:18:25.316324Z; it is under seven days old.
May explicitly approved a cooldown exception for this exact pinned image and
isolated synthetic database on November 18. This does not waive package checks or
the cooldown for other images. Compose and the startup helper pin this digest.
Sources: [Docker Hub metadata](https://hub.docker.com/v2/repositories/library/postgres/tags/18.7-bookworm)
and [official repo-info](https://raw.githubusercontent.com/docker-library/repo-info/master/repos/postgres/remote/18.7-bookworm.md).
Copy this provenance and exception into the ADR after Claude allocates its number. The
backend and migration startup require DATABASE_URL, then verify database name
clearauth_integration and server major 18. Database tests require a separate explicit
TEST_DATABASE_URL naming a different database; they must never fall back to the
application URL. Unit tests remain database-free. No app container is in scope.

## Driver, migration and startup contract

Use Psycopg 3.3.8 with its matching binary extra; Windows uses tzdata 2026.6.
Versioned SQL files avoid adding a separate migration-framework dependency.
Both packages were acknowledged and vetted before installation; the combined
installed Python environment audit reports no OSV advisories. This does not
attest native libraries, the interpreter or the operating system.

Configuration rejects another host/port, missing credentials, connection-option
queries, database names outside the application/test allowlist and decoded
credential control characters. The connection verifies database name and server
major before callers receive it. Errors contain fixed metadata codes, never
driver diagnostics or URLs. Connections use a three-second connect timeout,
five-second statement timeout and two-second lock timeout. These choices are
limited to local synthetic development; deployment configuration needs a separate
decision.

Migration execution failures retain the trusted migration version and SQLSTATE
in a typed MigrationError, without SQL/value/credential text. Connection,
identity and outer-transaction failures remain sanitized fixed-code errors.

From backend, `python -m storage.migrate` requires explicit DATABASE_URL;
`python -m storage.migrate --test` requires explicit TEST_DATABASE_URL. Neither
has a fallback. Startup verifies connectivity/identity and does no DDL. Operators
must migrate before using future repositories. This foundation does not change
existing in-memory audit/review stores or add case HTTP endpoints.

Migrations use UTF-8 source-file byte checksums, ordered versions, a registry and
a transaction-scoped PostgreSQL advisory lock. All pending SQL and registry writes
commit together, after identity verification; failure rolls back the batch. An
installed checksum change, missing local history or gap in installed history
blocks execution. Repeated execution is a no-op. Rollback/downgrade commands are
not supplied; corrective changes require new reviewed migration files.

## Local verification and limits

Dedicated test database: clearauth_integration_test_codex_20261118, on the same
isolated PG18 server. No test falls back to the application URL. PostgreSQL tests
are marked `postgres` and skip without explicit TEST_DATABASE_URL; invalid
configuration fails rather than skips. Each test creates a UUID schema and removes
only that schema in the validated test database. The test database and Docker
volume are retained. Application database schema remains unchanged.

Real-database tests cover repeat execution, checksum/missing/order rejection,
all-pending rollback, simultaneous migration runners, constraints, and persistence
after reconnect. Reconnect proves committed writes across connections; it is not
a container recreation/restart test. Docker pipe access prevents that test here.
The initialization user is administrative; least-privilege production roles and
a containerized backend are out of scope.

This remains an unnumbered PR B decision draft until coordinating Claude assigns
the free ADR number and integrates it into the architecture index.

