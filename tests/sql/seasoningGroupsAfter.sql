do $$ begin
  if (select count(*) from recipes where meta->>'seasoning_group_version'='1')<>95 then raise exception '更新品数が95品ではない'; end if;
  if exists(select 1 from recipes r where r.meta->>'seasoning_group_version'='1' and (
    r.meta->>'ingredients_text' is distinct from (select string_agg(s.text,E'\n' order by s.position) from recipe_steps s where s.recipe_id=r.id and s.phase='seasoning')
    or r.meta->>'steps_text' is distinct from (select string_agg(s.text,E'\n' order by s.position) from recipe_steps s where s.recipe_id=r.id and s.phase='evening')
  )) then raise exception '材料と工程の保存先が一致しない'; end if;
  if exists(select 1 from recipes r join fixture_recipe_snapshots f on f.id=r.id where r.meta->>'seasoning_group_version' is null
    and (to_jsonb(r) is distinct from f.recipe or f.steps is distinct from (select jsonb_agg(to_jsonb(s) order by s.phase,s.position) from recipe_steps s where s.recipe_id=r.id)))
  then raise exception '対象外の料理を変更した'; end if;
  if exists(select 1 from task_states ts join plan_entries pe on pe.id=ts.plan_entry_id join recipes r on r.id=pe.recipe_id
    where r.meta->>'nutrition_catalog_id'='chicken-teriyaki' and pe.date >= (timezone('Asia/Tokyo',now()))::date and ts.checked)
  then raise exception '更新された工程のチェックが残った'; end if;
  if exists(select 1 from task_states ts join plan_entries pe on pe.id=ts.plan_entry_id
    where pe.date < (timezone('Asia/Tokyo',now()))::date and not ts.checked)
  then raise exception '過去のチェックを戻した'; end if;
  raise notice 'PASS: 95品の保存・再読込、対象外の保持、当日以降のチェック初期化';
end $$;
update task_states set checked=true;
create table fixture_after_update as select r.id,to_jsonb(r) as recipe,
  (select jsonb_agg(to_jsonb(s) order by s.phase,s.position) from recipe_steps s where s.recipe_id=r.id) as steps from recipes r;
