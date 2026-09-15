param([switch]$Restart)

# Launch only the isolated QA API. Never inherit the application's remote .env
# database URL, and never stop another server or workspace process.
$ErrorActionPreference = 'Stop'
$qaBackend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$qaWorkspace = [IO.Path]::GetFullPath((Join-Path $qaBackend '..'))
$qaPython = Join-Path $qaBackend '.runtime/Scripts/python.exe'
$qaLogs = Join-Path $qaWorkspace '.runlogs'
$qaPidFile = Join-Path $qaLogs 'vowel-qa-api.pid'
if (-not (Test-Path -LiteralPath $qaPython)) { throw 'QA Python environment is missing.' }
if (-not (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue)) {
    throw 'Local MongoDB must be running on port 27017 before starting QA.'
}
New-Item -ItemType Directory -Path $qaLogs -Force | Out-Null

$qaListener = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($qaListener) {
    if (-not $Restart) { throw 'Port 8001 is already in use. Pass -Restart to restart a verified QA process.' }
    $qaRunning = Get-CimInstance Win32_Process -Filter "ProcessId = $($qaListener.OwningProcess)"
    $qaParent = Get-CimInstance Win32_Process -Filter "ProcessId = $($qaRunning.ParentProcessId)"
    $qaKnownLauncher = if (Test-Path -LiteralPath $qaPidFile) { [int](Get-Content -LiteralPath $qaPidFile -Raw).Trim() } else { 0 }
    $qaCommandMatches = $qaRunning.CommandLine -match '-m uvicorn app\.main:app --host 127\.0\.0\.1 --port 8001(?:\s|$)'
    $qaOwnedDirect = $qaRunning.ProcessId -eq $qaKnownLauncher -and $qaRunning.ExecutablePath -eq $qaPython
    $qaOwnedChild = $qaParent -and $qaParent.ProcessId -eq $qaKnownLauncher -and $qaParent.ExecutablePath -eq $qaPython -and $qaParent.CommandLine -match '--port 8001(?:\s|$)'
    if (-not $qaCommandMatches -or -not ($qaOwnedDirect -or $qaOwnedChild)) {
        throw 'Refusing to stop port 8001: its process is not the recorded QA launcher or its verified child.'
    }
    Stop-Process -Id $qaRunning.ProcessId -Force
    if ($qaOwnedChild) { Stop-Process -Id $qaParent.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

$env:MONGODB_URL = 'mongodb://127.0.0.1:27017'
$env:DB_NAME = 'speakeasy_vowel_qa_20260906'
$env:APP_ENV = 'test'
$env:USE_TF = '0'
$env:INDICCONFORMER_ENABLED = 'false'
$env:PYTHONUNBUFFERED = '1'
$env:CORS_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174'
$qaProcess = Start-Process -FilePath $qaPython -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8001' `
    -WorkingDirectory $qaBackend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $qaLogs 'vowel-qa-api.out.log') `
    -RedirectStandardError (Join-Path $qaLogs 'vowel-qa-api.err.log') -PassThru
$qaProcess.Id | Set-Content -LiteralPath $qaPidFile
Write-Output "QA launcher PID $($qaProcess.Id); http://127.0.0.1:8001; MongoDB 127.0.0.1:27017 / speakeasy_vowel_qa_20260906"
