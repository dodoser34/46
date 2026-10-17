# Запуск автотестов бэкенда.
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "backend")
& .\.venv\Scripts\python.exe -m pytest -v
