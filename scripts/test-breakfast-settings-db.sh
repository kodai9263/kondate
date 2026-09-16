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
"${psql_cmd[@]}" -f tests/sql/breakfastSettings.sql > "$test_dir/assertions.log" 2>&1 || {
  cat "$test_dir/assertions.log"
  exit 1
}
cat "$test_dir/assertions.log"
printf '朝食DB検証完了。ログ: %s\n' "$test_dir"

# 同じ版を2接続が同時に編集した場合、確定するのは1件だけ。
race_revision=$("${psql_cmd[@]}" -Atc "select revision from household_breakfast_versions where household_id = (select household_id from profiles where id = '10000000-0000-4000-8000-000000000011') order by effective_date desc limit 1;")
race_pids=()
for attempt in 1 2; do
  "${psql_cmd[@]}" -c "begin; set role authenticated; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true); select save_household_breakfast('$race_revision','{\"enabled\":false,\"items\":[]}'::jsonb); select pg_sleep(0.2); commit;" > "$test_dir/race-$attempt.log" 2>&1 &
  race_pids+=("$!")
done
race_successes=0
for race_pid in "${race_pids[@]}"; do
  if wait "$race_pid"; then race_successes=$((race_successes + 1)); fi
done
if [[ "$race_successes" -ne 1 ]]; then
  cat "$test_dir"/race-*.log
  exit 1
fi
printf 'PASS: 同じ版からの同時保存は1件だけ確定する\n'
