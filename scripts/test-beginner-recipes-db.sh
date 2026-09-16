#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pg_bin=$(pg_config --bindir)
audit_dir=$(mktemp -d "${TMPDIR:-/tmp}/kondate-recipes.XXXXXX")
"$pg_bin/initdb" -D "$audit_dir/data" -A trust --no-locale -E UTF8 > "$audit_dir/init.log"
trap '"$pg_bin/pg_ctl" -D "$audit_dir/data" -m fast stop > /dev/null 2>&1 || true' EXIT
"$pg_bin/pg_ctl" -D "$audit_dir/data" -l "$audit_dir/server.log" -o "-F -k $audit_dir -c listen_addresses=''" start > /dev/null
pg_run=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -q -h "$audit_dir" -d postgres)
"${pg_run[@]}" -f tests/sql/authRealtimeFixture.sql > "$audit_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  if [[ "$migration" == *202609160035* ]]; then "${pg_run[@]}" -f tests/sql/beginnerRecipesBefore.sql >> "$audit_dir/migrations.log" 2>&1; fi
  "${pg_run[@]}" --single-transaction -f "$migration" >> "$audit_dir/migrations.log" 2>&1 || { cat "$audit_dir/migrations.log"; exit 1; }
done
"${pg_run[@]}" -f tests/sql/beginnerRecipesAfter.sql > "$audit_dir/assertions.log" 2>&1 || { cat "$audit_dir/assertions.log"; exit 1; }
"${pg_run[@]}" --single-transaction -f supabase/migrations/202609160035_beginner_recipe_details.sql >> "$audit_dir/assertions.log" 2>&1
"${pg_run[@]}" -c "do \$\$ begin if exists(select 1 from task_states where not checked) then raise exception '再適用でチェックが消えた'; end if; raise notice 'PASS: 同じ更新を再適用してもチェックを維持'; end; \$\$;" >> "$audit_dir/assertions.log" 2>&1
"${pg_run[@]}" -f tests/sql/beginnerRecipeCustomization.sql >> "$audit_dir/assertions.log" 2>&1 || { cat "$audit_dir/assertions.log"; exit 1; }
cat "$audit_dir/assertions.log"
printf 'DB検証ログ: %s\n' "$audit_dir"
