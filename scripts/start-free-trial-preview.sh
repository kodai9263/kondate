#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
preview_dir=$(mktemp -d "${TMPDIR:-/tmp}/kondate-free-trial-preview.XXXXXX")
pg_bin=$(pg_config --bindir)
"$pg_bin/initdb" -D "$preview_dir/data" -A trust --no-locale -E UTF8 > "$preview_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$preview_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$preview_dir/data" -l "$preview_dir/server.log" -o "-F -k $preview_dir -c listen_addresses=''" start > /dev/null
psql_cmd=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$preview_dir" -d postgres)
"${psql_cmd[@]}" -f tests/sql/authRealtimeFixture.sql > "$preview_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  "${psql_cmd[@]}" --single-transaction -f "$migration" >> "$preview_dir/migrations.log" 2>&1
done
"${psql_cmd[@]}" -c "insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000021','preview@example.test')"
SHOPPING_TEST_SOCKET="$preview_dir" node scripts/preview-free-trial.mjs
