$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force backups | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF blogcms > /tmp/cms-backup.sql'
if ($LASTEXITCODE -ne 0) { throw "Database backup failed" }
docker compose cp mysql:/tmp/cms-backup.sql "backups/blogcms-$stamp.sql"
if ($LASTEXITCODE -ne 0) { throw "Copy backup failed; container file retained" }
docker compose exec -T mysql rm /tmp/cms-backup.sql
Write-Host "Saved backups/blogcms-$stamp.sql"
