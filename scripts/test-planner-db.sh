#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
planner_test_dir=$(mktemp -d /tmp/kondate-planner.XXXXXX)
pg_bin=$(pg_config --bindir)
"$pg_bin/initdb" -D "$planner_test_dir/data" -A trust --no-locale -E UTF8 > "$planner_test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$planner_test_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$planner_test_dir/data" -l "$planner_test_dir/server.log" -o "-F -k $planner_test_dir -c listen_addresses=''" start > /dev/null
psql_cmd=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$planner_test_dir" -d postgres)
"${psql_cmd[@]}" -f tests/sql/authRealtimeFixture.sql > "$planner_test_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  "${psql_cmd[@]}" --single-transaction -f "$migration" >> "$planner_test_dir/migrations.log" 2>&1
done
"${psql_cmd[@]}" -f supabase/seed/seed.sql > "$planner_test_dir/seed.log" 2>&1
"${psql_cmd[@]}" -c "insert into auth.users (id,email) values ('10000000-0000-4000-8000-000000000021','planner@example.test');" > "$planner_test_dir/user.log" 2>&1
export SHOPPING_TEST_SOCKET="$planner_test_dir"
node scripts/test-planner-db.mjs
