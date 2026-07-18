---
name: verify
description: Build, launch, and drive the ClearAuth SPA (demo + live modes) to observe a change at its surface.
---

# Verifying ClearAuth changes at runtime

## Launch

Backend (mock LLM, no network, from `backend/`):

```bash
LLM_BACKEND=mock DEMO_USER=reviewer DEMO_PASSWORD=clearauth-demo \
API_SECRET_KEY=smoke-secret CORS_ORIGINS=http://localhost:5174 \
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend, demo mode (fixture-only, the static-deploy behavior):
`npm run build && npx vite preview --port 4173` — build WITHOUT
`VITE_API_BASE_URL` or you'll bake live mode into the bundle.

Frontend, live mode:
`VITE_API_BASE_URL=http://localhost:8000 npx vite --port 5174 --strictPort`.
Port 5173 is often taken by the user's own dev server — don't kill it; use
5174 and set `CORS_ORIGINS` to match (backend default only allows 5173).

## Drive

Playwright chromium is installed (repo has `@playwright/test`; import
`chromium` from `node_modules/playwright/index.mjs` by absolute file URL if
your script lives outside the repo). Useful selectors: login = `text=live
sign in` + label-scoped inputs; portfolio = sidebar `text=Case Queue`; rail
= `text=Live operations`; resume = `text=Exception tier — human review
required` → `button:has-text("Submit review")`.

To seed a parked exception run without driving generation (any run with
`criteria_results: []` routes to the exception tier and parks):

```bash
curl -s -X POST http://127.0.0.1:8000/api/appeal/generate \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer smoke-secret' \
  -d '{"scenario_id":"verify-x","drug":"Ozempic (semaglutide)",
       "diagnosis":"Type 2 Diabetes Mellitus","denial_text":"denied",
       "denial_reason":"step therapy","plan":"Cigna Connect 500 PPO",
       "plan_id":"CIGNA-CNF360-2024","criteria_results":[]}'
```

## Gotchas

- The pending-review rail fetches on mount only — navigate away and back
  (e.g. Quality Report → Case Queue) to refetch after seeding.
- A page reload in live mode drops you back to the login form even with a
  valid cookie (known O14 auto-login gap) — log in again, don't debug it.
- `smoke_tour.py` (`backend/tools/`) exercises the pipelines in-process —
  good for backend behavior, but it is NOT a UI surface.
- Flows worth driving after shell changes: demo tree renders with no login
  gate/chips/rail; live login (wrong + right password); portfolio SIMULATED
  banner + LIVE rail; park → open → approve as-is → queue clears + audit
  pair; `?console=dev` (LiveApp dev console, live mode only).
