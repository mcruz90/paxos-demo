# ADR-0012: Generated TypeScript wire types from OpenAPI; Pydantic is the authored source

- **Status:** Accepted
- **Date:** 2026-07-06
- **Decided by:** May + Claude Code (Frontend-integration sprint, Slice 1)

## Context

The frontend is moving toward live backend integration. Today
[src/types.ts](../../../src/types.ts) hand-mirrors backend concepts, kept honest
by a manual anchor-join parity guard
([scenarios_parity.test.ts](../../../src/data/scenarios_parity.test.ts)). Hand
mirroring is a second source of truth for the wire contract: the moment a
Pydantic field changes and nobody updates `types.ts`, the client and server
disagree and only a runtime error catches it. This project has already been
bitten by contract drift living in one place while the truth lived in another
(the whole reason `docs/architecture/` exists).

FastAPI already emits an OpenAPI document at `/openapi.json`, derived from the
Pydantic request/response models. That document is a machine-readable contract
that cannot drift from the backend — it *is* the backend's schema. The question
was whether to keep authoring TypeScript wire types by hand, or generate them
from that document.

One wrinkle: the SSE routes (`/api/appeal/generate`, `/api/appeal/resume`,
`/api/pa/submit`) return `StreamingResponse`, so FastAPI has no response model
to introspect — the event shapes a client actually receives
(`StepEvent`/`ChunkEvent`/`DoneEvent`/`ErrorEvent`, `InitialPaDoneEvent`) do
**not** appear in `components.schemas` on their own. Typed SSE events are the
whole point of a generated wire contract, so those shapes have to be registered
deliberately.

## Decision

We will **generate the TypeScript wire types from the backend's OpenAPI schema.
Pydantic stays the single authored source of truth; the TypeScript types are a
build product.**

The pipeline is three steps, all reproducible and deterministic:

1. **Dump** — [backend/tools/dump_openapi.py](../../../backend/tools/dump_openapi.py)
   calls `app.openapi()` (no server boot, no network, no LLM backend) and writes
   `openapi.json` at the repo root with **sorted keys** so regenerated dumps
   diff cleanly. Exposed as `npm run api:dump`.
2. **Generate** — `openapi-typescript` (dev-only, build-time, zero runtime
   footprint) converts `openapi.json` →
   [src/generated/api-types.d.ts](../../../src/generated/api-types.d.ts).
   Exposed as `npm run api:types`.
3. **Guard** — a CI job regenerates both artifacts and fails on any diff (see
   [08-deployment-ci.md](../08-deployment-ci.md)). This *replaces* hand-parity
   for wire shapes — the same drift-gate philosophy as `scenarios_parity.test.ts`.

**SSE event registration.** The event models are registered explicitly in
[backend/openapi_ext.py](../../../backend/openapi_ext.py), which customizes
`app.openapi` (wired in [main.py](../../../backend/main.py)) to inject the SSE
event schemas — derived from the same Pydantic `BaseModel`s, never hand-written
— into `components.schemas`. This runs for **both** the live server's
`/openapi.json` and the checked-in dump, so the live contract and the generated
types share one registration point (DRY). We chose `app.openapi` customization
over adding `responses=` metadata to each route decorator so the streaming
routes' handler signatures stay about the stream, not about documentation, and
all SSE-schema wiring lives in one documented file.

**Generated artifacts are checked in.** The demo deploy builds from a static
repo with no backend available at build time (ADR-0005), so `openapi.json` and
`api-types.d.ts` are committed, not generated during `vite build`.

**TypeScript 6 peer lag.** `openapi-typescript@7` still declares a peer of
`typescript@^5.x`; this project runs `typescript@6`. The peer range lags the TS
6 release — the tool is verified working under TS 6. A **scoped** npm
`overrides` entry in [package.json](../../../package.json) pins the tool's
`typescript` peer to the root's version:

```json
"overrides": {
  "openapi-typescript": { "typescript": "$typescript" }
}
```

The `$typescript` reference resolves to whatever the root declares, so it is not
a version to keep in sync. This was chosen over a repo-wide
`legacy-peer-deps=true` (`.npmrc`) deliberately: `legacy-peer-deps` would
disable npm's peer-conflict validation for *every* future install, and peer
conflicts are one of the signals the dependency-security posture relies on
(CLAUDE.md §Dependency Security). The override scopes the workaround to exactly
this one lag while leaving peer validation on everywhere else. Drop the override
once `openapi-typescript` widens its peer range to include TS 6.

## Consequences

- **The wire contract has one author.** A Pydantic field change flows to the
  TypeScript types by regeneration; CI fails if someone forgets to regenerate.
  No hand-maintained mirror to drift.
- **This slice is the pipeline only.** `src/types.ts` and existing components
  are **not** migrated to the generated types yet — that migration is the next
  slice, done alongside the SSE client so it is driven by real usage. This ADR
  establishes dump → generate → guard; it does not retire `types.ts`.
- **No runtime dependency added.** `openapi-typescript` is `devDependencies`,
  emits a `.d.ts`, and never enters the browser bundle or touches PHI. Its only
  transitive of note is `@redocly/openapi-core` (build-time parser).
- **The peer-lag workaround is scoped, not repo-wide.** The `overrides` entry
  touches only `openapi-typescript`'s `typescript` peer; npm's peer-conflict
  validation stays active for every other package. Temporary — remove once
  upstream widens its peer range.
- **The freshness guard needs both toolchains.** The CI job runs Node *and* uv
  (Python) to regenerate end-to-end — heavier than a Node-only or Python-only
  job, but it is the only way to prove the two-language pipeline is fresh.
- **Live `/openapi.json` now carries SSE event shapes**, so when the SSE client
  slice lands it can generate against a running server or the committed dump and
  get identical output.
