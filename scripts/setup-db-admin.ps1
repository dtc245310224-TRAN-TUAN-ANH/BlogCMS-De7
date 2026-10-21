$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# Create/reset only the optional phpMyAdmin administrator for blogcms.
# Existing CMS users and the application's cms_app credentials are unchanged.
$bytes = New-Object byte[] 24
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$password = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
$sql = "CREATE USER IF NOT EXISTS 'admin'@'%' IDENTIFIED BY '$password'; ALTER USER 'admin'@'%' IDENTIFIED BY '$password'; GRANT ALL PRIVILEGES ON blogcms.* TO 'admin'@'%';"
$sql | docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
if ($LASTEXITCODE -ne 0) { throw 'Could not create/update database administrator.' }
New-Item -ItemType Directory -Force secrets | Out-Null
$text = "URL=http://localhost:8081`nUSERNAME=admin`nPASSWORD=$password`nDATABASE=blogcms`n"
[IO.File]::WriteAllText((Join-Path (Get-Location) 'secrets/phpmyadmin-admin.txt'), $text, (New-Object Text.UTF8Encoding($false)))
Write-Host 'Database administrator updated. Read secrets/phpmyadmin-admin.txt locally. Do not publish this file.'
