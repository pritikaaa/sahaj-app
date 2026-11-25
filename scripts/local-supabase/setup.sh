#!/usr/bin/env bash
# Creates a local Postgres database that mirrors the Supabase project:
# roles anon/authenticated (Supabase has them built in) + supabase/schema.sql.
# Needs a running local Postgres you can reach as the "postgres" superuser.
set -euo pipefail
DB="${LOCAL_DB:-sahaj_local}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PGOPTIONS="--client-min-messages=warning"
PSQL=(psql -v ON_ERROR_STOP=1 -U postgres -h "${PGHOST:-localhost}")

"${PSQL[@]}" -d postgres -tc "select 1 from pg_roles where rolname='anon'" | grep -q 1 \
  || "${PSQL[@]}" -d postgres -c "create role anon nologin"
"${PSQL[@]}" -d postgres -tc "select 1 from pg_roles where rolname='authenticated'" | grep -q 1 \
  || "${PSQL[@]}" -d postgres -c "create role authenticated nologin"
if [ "${RESET:-0}" = "1" ]; then "${PSQL[@]}" -d postgres -c "drop database if exists $DB"; fi
"${PSQL[@]}" -d postgres -tc "select 1 from pg_database where datname='$DB'" | grep -q 1 \
  || "${PSQL[@]}" -d postgres -c "create database $DB"
"${PSQL[@]}" -d "$DB" -q -f "$ROOT/supabase/schema.sql"
echo "schema applied to $DB"
