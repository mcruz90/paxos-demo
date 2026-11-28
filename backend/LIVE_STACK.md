# Synthetic pediatric live stack

Use PowerShell, Docker Compose, and the project's backend Python environment. Run the first block from the product checkout that owns the Compose volume and its ignored secret file. For an existing stack, reuse that checkout and password. For a new volume, the block creates a local random password.

```powershell
New-Item -ItemType Directory -Force .integration-db | Out-Null
if (!(Test-Path .integration-db/password)) {
    [IO.File]::WriteAllText("$PWD/.integration-db/password", [guid]::NewGuid().ToString("N"))
}
docker compose -f compose.integration-db.yaml up -d --wait
if ($LASTEXITCODE) { throw "PostgreSQL startup failed" }
$dbPassword = [uri]::EscapeDataString((Get-Content -Raw .integration-db/password).Trim())
$env:DATABASE_URL = "postgresql://clearauth:${dbPassword}@127.0.0.1:55432/clearauth_integration"
```

In the same shell, enter the T-28 product checkout's `backend` directory with its backend environment activated. The seed applies the versioned migrations and provisions the reviewer, panel, case, and creation event in one transaction. Repeated runs print the same UUID. The server reads its fixture binding when it imports the app.

```powershell
$env:DEMO_USER = "reviewer"
$env:DEMO_PASSWORD = "clearauth-demo"
$env:LLM_BACKEND = "mock"
$env:PEDIATRIC_FIXTURE_CASE_ID = python -m tools.seed_live_stack
if ($LASTEXITCODE) { throw "Seed failed" }
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

For the live UI, run the following from the frontend checkout in a second shell. Open `http://localhost:5173`, sign in as the reviewer, and select the pediatric case. G-08's discovery spec is available on the G-08 branch. Start Vite with these bindings before running that spec.

```powershell
$env:VITE_API_BASE_URL = "http://localhost:8000"
$env:VITE_PEDIATRIC_CASE_ID = "42010000-0000-4000-8000-000000000001"
npm run dev
```

For T-26 live mode, use the same reviewer session identity. Its create request uses `journey-anchor-pediatric` and replays the seeded PT-4201 case. The live driver relies on the server's existing binding. With the correct binding, GET `/api/patients/PT-4201/cases/{case_id}/assessment` returns the swallowing pathway, and POST to the sibling `discovery` route with `{"expected_revision":1,"query":""}` returns the GI source.

From the T-26 harness checkout, point `JOURNEY_PRODUCT` to the T-28 checkout root and `JOURNEY_PYTHON` to its backend interpreter (the shared backend environment also works). Then run:

```powershell
$base = "http://localhost:8000"
$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -SessionVariable session -ContentType "application/json" -Body '{"username":"reviewer","password":"clearauth-demo"}'
$env:JOURNEY_COOKIE = $session.Cookies.GetCookieHeader([uri]"https://localhost:8000/")
$env:JOURNEY_CSRF = $login.csrf_token
python -m runtime_eval.journey --case anchor-pediatric --base-url $base --out results/runtime_eval/journey-live.jsonl
```
