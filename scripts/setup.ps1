$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if (Test-Path -LiteralPath ".env") {
    throw ".env already exists. Keep it for existing database volumes. See README for recovery."
}
function New-Secret {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return ([BitConverter]::ToString($bytes)).Replace("-","").ToLowerInvariant()
}
$values = [ordered]@{
 COMPOSE_PROJECT_NAME="blogcms-de7"
 MYSQL_ROOT_PASSWORD=(New-Secret)
 DB_PASSWORD=(New-Secret)
 EXPORTER_PASSWORD=(New-Secret)
 SESSION_SECRET=(New-Secret)
 ADMIN_EMAIL="admin@blog.local"
 ADMIN_PASSWORD=(New-Secret)
 GRAFANA_PASSWORD=(New-Secret)
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), (($values.GetEnumerator() | ForEach-Object {"$($_.Key)=$($_.Value)"}) -join "`n")+"`n", $utf8)
New-Item -ItemType Directory -Force "secrets" | Out-Null
[IO.File]::WriteAllText((Join-Path (Get-Location) "secrets/exporter.cnf"), "[client]`nuser=exporter`npassword=$($values.EXPORTER_PASSWORD)`nhost=mysql`n", $utf8)
Write-Host "Generated .env and secrets/exporter.cnf. Credentials stay on this machine."
Write-Host "Next: docker compose up -d --build"
