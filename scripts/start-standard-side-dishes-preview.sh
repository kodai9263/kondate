#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Auth/通信だけを差し替えた、一時Postgresでの画面検証。本番への接続情報は不要。
side_test_dir=$(mktemp -d /tmp/kondate-side-dishes.XXXXXX)
pg_bin=$(pg_config --bindir)
"$pg_bin/initdb" -D "$side_test_dir/data" -A trust --no-locale -E UTF8 > "$side_test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$side_test_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$side_test_dir/data" -l "$side_test_dir/server.log" -o "-F -k $side_test_dir -c listen_addresses=''" start > /dev/null
psql_cmd=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$side_test_dir" -d postgres)
"${psql_cmd[@]}" -f tests/sql/authRealtimeFixture.sql > "$side_test_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  "${psql_cmd[@]}" --single-transaction -f "$migration" >> "$side_test_dir/migrations.log" 2>&1
done
"${psql_cmd[@]}" -f supabase/seed/seed.sql > "$side_test_dir/seed.log" 2>&1
"${psql_cmd[@]}" -c "insert into auth.users (id,email) values ('10000000-0000-4000-8000-000000000021','side-preview@example.test');" > "$side_test_dir/user.log" 2>&1
"${psql_cmd[@]}" -f tests/sql/standardSideDishes.sql
export SHOPPING_TEST_SOCKET="$side_test_dir"
printf '一時DB: %s\n' "$side_test_dir"
node scripts/preview-standard-side-dishes.mjs
