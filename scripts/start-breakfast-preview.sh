#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 既存DBへは接続せず、専用の一時クラスタとUnixソケットのみを使う。
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/kondate-breakfast.XXXXXX")
pg_bin=$(pg_config --bindir)
"$pg_bin/initdb" -D "$test_dir/data" -A trust --no-locale -E UTF8 > "$test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$test_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/server.log" -o "-F -k $test_dir -c listen_addresses=''" start > /dev/null
psql_cmd=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$test_dir" -d postgres)
"${psql_cmd[@]}" -f tests/sql/authRealtimeFixture.sql > "$test_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  if ! "${psql_cmd[@]}" --single-transaction -f "$migration" >> "$test_dir/migrations.log" 2>&1; then
    cat "$test_dir/migrations.log"
    exit 1
  fi
done
export BREAKFAST_PG_SOCKET="$test_dir"
export BREAKFAST_PREVIEW_DIR="$test_dir/preview"
node scripts/preview-breakfast-settings.mjs
