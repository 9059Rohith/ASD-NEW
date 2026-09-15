$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $projectRoot 'backend')
try {
    if (!(Test-Path -LiteralPath '.runtime/Scripts/python.exe')) {
        python -m venv .runtime
        if ($LASTEXITCODE) { throw 'Python environment creation failed.' }
    }
    ./.runtime/Scripts/python.exe -m pip install -r requirements-core.txt
    if ($LASTEXITCODE) { throw 'Backend installation failed.' }
    if (!(Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
    ./.runtime/Scripts/python.exe scripts/download_phoneme_model.py
    if ($LASTEXITCODE) { throw 'Model installation failed.' }
} finally { Pop-Location }
Push-Location (Join-Path $projectRoot 'frontend')
try {
    npm ci
    if ($LASTEXITCODE) { throw 'Frontend installation failed.' }
} finally { Pop-Location }
Write-Output 'Installed. Ensure MongoDB is running and backend/.env is configured, then run scripts/start-local.ps1.'
