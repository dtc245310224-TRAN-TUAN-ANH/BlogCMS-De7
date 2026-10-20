#!/bin/bash
set -e
# setup scripts generate hexadecimal values; validation prevents SQL injection here.
[[ "$APP_DB_PASSWORD" =~ ^[a-f0-9]{48}$ ]] || { echo "Invalid APP_DB_PASSWORD"; exit 1; }
[[ "$EXPORTER_PASSWORD" =~ ^[a-f0-9]{48}$ ]] || { echo "Invalid EXPORTER_PASSWORD"; exit 1; }
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot < /schema.sql
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot <<SQL
DROP USER IF EXISTS 'root'@'%';
CREATE USER IF NOT EXISTS 'cms_app'@'%' IDENTIFIED BY '$APP_DB_PASSWORD';
GRANT SELECT,INSERT,UPDATE,DELETE ON blogcms.* TO 'cms_app'@'%';
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY '$EXPORTER_PASSWORD' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
SQL
