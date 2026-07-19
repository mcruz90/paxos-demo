#Requires -Version 7
<#
Launches the live ClearAuth stack for local exploration:

  UI       http://localhost:5174   (Vite dev server, live mode)
  Backend  http://127.0.0.1:8000   (FastAPI, mock LLM backend - no network/API keys needed)

Run from anywhere:  .\scripts\dev-live.ps1
Sign in with the credentials printed on launch. Ctrl+C here stops both
processes (the backend runs in its own window so its logs stay readable).

No .env file is required: every env var the backend needs is set inline
below. Values already set in your shell win over these defaults, so e.g.
  $env:DEMO_PASSWORD = 'something-else'; .\scripts\dev-live.ps1
overrides the password. These are local-dev placeholders, not secrets.

Port notes: 5173 is left alone (often occupied by a personal dev server);
this script pins the live UI to 5174 and points backend CORS at it.
#>

$repo = Split-Path $PSScriptRoot -Parent
$apiPort = 8000
$uiPort = 5174

$demoUser = $env:DEMO_USER ?? 'reviewer'
$demoPass = $env:DEMO_PASSWORD ?? 'clearauth-demo'
$apiSecret = $env:API_SECRET_KEY ?? 'local-dev-secret'

Write-Host ''
Write-Host 'ClearAuth live stack' -ForegroundColor Green
Write-Host "  UI        http://localhost:$uiPort"
Write-Host "  Backend   http://127.0.0.1:$apiPort  (LLM_BACKEND=mock)"
Write-Host "  Sign in   $demoUser / $demoPass"
Write-Host "  Dev tip   http://localhost:$uiPort/?console=dev opens the demoted LiveApp console"
Write-Host ''

$backendCmd = @"
`$env:LLM_BACKEND = 'mock'
`$env:DEMO_USER = '$demoUser'
`$env:DEMO_PASSWORD = '$demoPass'
`$env:API_SECRET_KEY = '$apiSecret'
`$env:CORS_ORIGINS = 'http://localhost:$uiPort'
Set-Location '$repo\backend'
uv run uvicorn main:app --host 127.0.0.1 --port $apiPort
"@
$backend = Start-Process pwsh -ArgumentList '-NoExit', '-Command', $backendCmd -PassThru

try {
  $env:VITE_API_BASE_URL = "http://localhost:$apiPort"
  Set-Location $repo
  npx vite --port $uiPort --strictPort
}
finally {
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  }
}
