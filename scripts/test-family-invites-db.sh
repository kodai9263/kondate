#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 既存DBへは接続せず、専用の一時クラスタとUnixソケットのみを使う。
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/kondate-invites.XXXXXX")
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
"${psql_cmd[@]}" -f tests/sql/guestFamilyInvites.sql > "$test_dir/assertions.log" 2>&1 || {
  cat "$test_dir/assertions.log"
  exit 1
}
cat "$test_dir/assertions.log"

# 同じ招待に別々の接続から同時参加しても、1人だけが確定する。
"${psql_cmd[@]}" -c "insert into public.household_invites (household_id, created_by, invite_token) select household_id, id, '20000000-0000-4000-8000-000000000009' from public.profiles where id = '10000000-0000-4000-8000-000000000001';"
race_pids=()
for suffix in 5 6; do
  "${psql_cmd[@]}" -c "begin; insert into auth.users (id, is_anonymous, raw_user_meta_data) values ('10000000-0000-4000-8000-00000000000$suffix', true, '{\"family_invite_token\":\"20000000-0000-4000-8000-000000000009\"}'); select pg_sleep(0.2); commit;" > "$test_dir/race-$suffix.log" 2>&1 &
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
race_users=$("${psql_cmd[@]}" -Atc "select count(*) from auth.users where id in ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006');")
[[ "$race_users" == "1" ]]
printf 'PASS: 同時参加は1人だけが確定し、もう1人の作成は取り消される\n'
printf '家族共有DB検証完了。ログ: %s\n' "$test_dir"
