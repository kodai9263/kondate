#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 本番・既存DBへ接続せず、一時クラスタだけで全マイグレーションを検証する。
shopping_test_dir=$(mktemp -d "${TMPDIR:-/tmp}/kondate-shopping.XXXXXX")
pg_bin=$(pg_config --bindir)
"$pg_bin/initdb" -D "$shopping_test_dir/data" -A trust --no-locale -E UTF8 > "$shopping_test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$shopping_test_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$shopping_test_dir/data" -l "$shopping_test_dir/server.log" -o "-F -k $shopping_test_dir -c listen_addresses=''" start > /dev/null
psql_cmd=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$shopping_test_dir" -d postgres)
"${psql_cmd[@]}" -f tests/sql/authRealtimeFixture.sql > "$shopping_test_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  if ! "${psql_cmd[@]}" --single-transaction -f "$migration" >> "$shopping_test_dir/migrations.log" 2>&1; then
    tail -70 "$shopping_test_dir/migrations.log"
    exit 1
  fi
done
"${psql_cmd[@]}" --single-transaction -f tests/sql/plannedShopping.sql > "$shopping_test_dir/assertions.log" 2>&1 || {
  cat "$shopping_test_dir/assertions.log"
  exit 1
}
cat "$shopping_test_dir/assertions.log"
printf '買い物DB検証完了。ログ: %s\n' "$shopping_test_dir"
