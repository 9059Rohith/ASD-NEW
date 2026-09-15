$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot 'backend/.runtime/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Run scripts/setup-local.ps1 first.' }
$env:USE_TF = '0'
$env:OPENBLAS_NUM_THREADS = '2'
$env:OMP_NUM_THREADS = '2'
# This launcher deliberately uses the local MongoDB instance; production settings
# remain configurable through the deployment environment.
if (!$env:MONGODB_URL) { $env:MONGODB_URL = 'mongodb://127.0.0.1:27017' }
if (!$env:DB_NAME) { $env:DB_NAME = 'speakeasy_asd' }
if (!$env:APP_ENV) { $env:APP_ENV = 'development' }
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'backend/models/vowel-classifier/classifier.joblib'))) {
    throw 'The trained vowel model is missing. Restore backend/models/vowel-classifier from the project distribution.'
}
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'backend/models/diphthong-classifier/classifier.joblib'))) {
    throw 'The AI/AU vowel model is missing. Restore backend/models/diphthong-classifier from the project distribution.'
}
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'backend/models/phoneme-onnx/vocab.json'))) {
    throw 'Run backend/scripts/download_phoneme_model.py first.'
}
$logRoot = Join-Path $projectRoot '.runlogs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$api = Start-Process -FilePath $pythonPath -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'local-api.out.log') -RedirectStandardError (Join-Path $logRoot 'local-api.err.log')
$web = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev -- --host 127.0.0.1' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'local-web.out.log') -RedirectStandardError (Join-Path $logRoot 'local-web.err.log')
Write-Output "API PID: $($api.Id); web PID: $($web.Id). Open http://127.0.0.1:5173. Logs: $logRoot"
