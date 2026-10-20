#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ ! -e .env ] || { echo ".env exists; do not regenerate credentials for existing volumes."; exit 1; }
umask 077
secret() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }
root=$(secret); db=$(secret); exporter=$(secret); session=$(secret); admin=$(secret); grafana=$(secret)
cat > .env <<EOF
COMPOSE_PROJECT_NAME=blogcms-de7
MYSQL_ROOT_PASSWORD=$root
DB_PASSWORD=$db
EXPORTER_PASSWORD=$exporter
SESSION_SECRET=$session
ADMIN_EMAIL=admin@blog.local
ADMIN_PASSWORD=$admin
GRAFANA_PASSWORD=$grafana
EOF
mkdir -p secrets
printf '[client]\nuser=exporter\npassword=%s\nhost=mysql\n' "$exporter" > secrets/exporter.cnf
# Readable by the exporter UID inside a bind mount. Keep the directory private.
chmod 644 secrets/exporter.cnf
echo 'Generated .env and secrets/exporter.cnf. Next: docker compose up -d --build'
