#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source_test_dir=$(mktemp -d /tmp/kondate-source-permissions-db.XXXXXX)
pg_bin=$(pg_config --bindir)
"$pg_bin/initdb" -D "$source_test_dir/data" -A trust --no-locale -E UTF8 > "$source_test_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$source_test_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$source_test_dir/data" -l "$source_test_dir/server.log" -o "-F -k $source_test_dir -c listen_addresses=''" start > /dev/null
psql_cmd=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$source_test_dir" -d postgres)
"${psql_cmd[@]}" -f tests/sql/authRealtimeFixture.sql > "$source_test_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  "${psql_cmd[@]}" --single-transaction -f "$migration" >> "$source_test_dir/migrations.log" 2>&1
done
"${psql_cmd[@]}" -f tests/sql/recipeSourcePermissions.sql
printf "検証ログ: %s\n" "$source_test_dir"
if "${psql_cmd[@]}" -v owner_email=source-other@example.test -f scripts/configure-recipe-permission-owner.sql > "$source_test_dir/reject-owner-change.log" 2>&1; then
  echo "既存管理者の上書きが拒否されませんでした" >&2
  exit 1
fi
if "${psql_cmd[@]}" -v owner_email=source-family@example.test -f scripts/configure-recipe-permission-owner.sql > "$source_test_dir/reject-unconfirmed.log" 2>&1; then
  echo "未確認メールが拒否されませんでした" >&2
  exit 1
fi
printf "管理者設定・再実行・上書き拒否・未確認メール拒否: 成功\n"
