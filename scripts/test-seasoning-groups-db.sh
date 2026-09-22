#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pg_bin=$(pg_config --bindir)
audit_dir=$(mktemp -d "${TMPDIR:-/tmp}/kondate-seasonings.XXXXXX")
"$pg_bin/initdb" -D "$audit_dir/data" -A trust --no-locale -E UTF8 > "$audit_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$audit_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$audit_dir/data" -l "$audit_dir/server.log" -o "-F -k $audit_dir -c listen_addresses=''" start > /dev/null
pg_run=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$audit_dir" -d postgres)
"${pg_run[@]}" -f tests/sql/authRealtimeFixture.sql > "$audit_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  if [[ "$migration" == *202609160035* ]]; then "${pg_run[@]}" -f tests/sql/beginnerRecipesBefore.sql >> "$audit_dir/migrations.log" 2>&1; fi
  "${pg_run[@]}" --single-transaction -f "$migration" >> "$audit_dir/migrations.log" 2>&1 || { cat "$audit_dir/migrations.log"; exit 1; }
done
node --import tsx tests/fixtures/build-seasoning-db-fixture.ts > "$audit_dir/before.sql"
"${pg_run[@]}" -f "$audit_dir/before.sql" > "$audit_dir/assertions.log" 2>&1 || { cat "$audit_dir/assertions.log"; exit 1; }
"${pg_run[@]}" -f scripts/sql/update-seasoning-groups.sql >> "$audit_dir/assertions.log" 2>&1 || { cat "$audit_dir/assertions.log"; exit 1; }
"${pg_run[@]}" -f tests/sql/seasoningGroupsAfter.sql >> "$audit_dir/assertions.log" 2>&1 || { cat "$audit_dir/assertions.log"; exit 1; }
"${pg_run[@]}" -f scripts/sql/update-seasoning-groups.sql >> "$audit_dir/assertions.log" 2>&1
"${pg_run[@]}" -c "do \$\$ begin
  if exists(select 1 from task_states where not checked) then raise exception '再適用でチェックが消えた'; end if;
  if exists(select 1 from recipes r join fixture_after_update f on f.id=r.id where to_jsonb(r) is distinct from f.recipe or f.steps is distinct from (select jsonb_agg(to_jsonb(s) order by s.phase,s.position) from recipe_steps s where s.recipe_id=r.id)) then raise exception '再適用でデータが変わった'; end if;
  raise notice 'PASS: 再適用は0件、工程IDとチェックを維持';
end \$\$;" >> "$audit_dir/assertions.log" 2>&1
"${pg_run[@]}" -c "update recipe_steps set text='監査後に家庭で編集した工程' where recipe_id='0a282bae-0cb7-417d-9cb6-b3bacf2d531f' and phase='evening' and position=0;" >> "$audit_dir/assertions.log" 2>&1
if "${pg_run[@]}" -f scripts/sql/update-seasoning-groups.sql > "$audit_dir/conflict.log" 2>&1; then
  echo 'FAIL: 更新後の編集を上書きした'; exit 1
fi
"${pg_run[@]}" -c "do \$\$ begin
  if not exists(select 1 from recipe_steps where recipe_id='0a282bae-0cb7-417d-9cb6-b3bacf2d531f' and text='監査後に家庭で編集した工程') then raise exception '編集が失われた'; end if;
  raise notice 'PASS: 監査後の編集を検知して全体を中止';
end \$\$;" >> "$audit_dir/assertions.log" 2>&1
cat "$audit_dir/assertions.log"
printf 'DB検証ログ: %s\n' "$audit_dir"
