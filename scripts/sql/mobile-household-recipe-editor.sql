-- 家族の自作メニューの登録・編集。適用前にローカルDBで検証する。
-- 工程テーブルは直接更新権限がないため、本人・家族・料理種別を検証した関数に更新を限定する。
create or replace function public.household_recipe_editor(target_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.recipes%rowtype; fields jsonb; n public.recipe_nutrition%rowtype;
begin
  if auth.uid() is null or public.current_household_id() is null then raise exception 'unauthenticated'; end if;
  if not coalesce(public.can_use_breakfast_settings(),false) then raise exception 'family_access_required'; end if;
  select * into r from public.recipes where id=target_id and household_id=public.current_household_id() and archived_at is null and category <> 'breakfast' and coalesce(meta->>'step_customization','false') <> 'true';
  if not found then raise exception 'recipe_not_found'; end if;
  select * into n from public.recipe_nutrition where recipe_id=target_id;
  fields := jsonb_build_object('name',r.name,'side',coalesce(r.meta->>'side',''),'cookMinutes',coalesce((r.meta->>'total_minutes')::int,r.cook_minutes),'servings',r.servings_base,'proteinSource',r.protein_source,
    'ingredients',coalesce((select string_agg(text,E'\n' order by position) from public.recipe_steps where recipe_id=target_id and phase='seasoning'),r.meta->>'ingredients_text',''),
    'morning',coalesce((select string_agg(text,E'\n' order by position) from public.recipe_steps where recipe_id=target_id and phase='morning'),''),
    'steps',coalesce((select string_agg(text,E'\n' order by position) from public.recipe_steps where recipe_id=target_id and phase='evening'),''),
    'energyKcal',n.energy_kcal,'proteinG',n.protein_g,'fatG',n.fat_g,'carbsG',n.carbs_g,'fiberG',n.fiber_g,'saltG',n.salt_g,'vegetablesG',n.vegetables_g);
  return jsonb_build_object('fields',fields,'revision',md5(fields::text));
end $$;

create or replace function public.save_household_recipe_editor(target_id uuid, request_id uuid, expected_revision text, fields jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.recipes%rowtype; household uuid := public.current_household_id(); current_editor jsonb; k text; lim numeric;
begin
  if auth.uid() is null or household is null then raise exception 'unauthenticated'; end if;
  if not coalesce(public.can_use_breakfast_settings(),false) then raise exception 'family_access_required'; end if;
  if target_id is null or request_id is null then raise exception 'invalid_recipe'; end if;
  -- 同じ保存の再試行でも重複登録しない。同じ料理への保存を直列化する。
  perform pg_advisory_xact_lock(hashtextextended(target_id::text,0));
  select * into r from public.recipes where id=target_id for update;
  if found then
    if r.household_id is distinct from household or r.archived_at is not null or r.category='breakfast' or r.meta->>'step_customization'='true' then raise exception 'recipe_not_found'; end if;
    if r.meta->>'editor_request_id'=request_id::text then return target_id; end if;
    current_editor := public.household_recipe_editor(target_id);
    if expected_revision is null or expected_revision is distinct from current_editor->>'revision' then raise exception 'recipe_changed'; end if;
  elsif expected_revision is not null then raise exception 'recipe_not_found';
  end if;
  if jsonb_typeof(fields) is distinct from 'object' or
    length(trim(coalesce(fields->>'name',''))) not between 1 and 80 or
    length(coalesce(fields->>'side','')) > 120 or
    length(trim(coalesce(fields->>'ingredients',''))) not between 1 and 4000 or
    length(trim(coalesce(fields->>'steps',''))) not between 1 and 4000 or
    length(coalesce(fields->>'morning','')) > 4000 or
    coalesce(fields->>'proteinSource','') not in ('fish','meat','soy','egg','noodle') or
    coalesce((fields->>'cookMinutes')::numeric,-1) not between 1 and 240 or
    (fields->>'cookMinutes')::numeric <> trunc((fields->>'cookMinutes')::numeric) or
    coalesce((fields->>'servings')::numeric,-1) not between 1 and 20 or
    (fields->>'servings')::numeric <> trunc((fields->>'servings')::numeric)
  then raise exception 'invalid_recipe'; end if;
  foreach k in array array['energyKcal','proteinG','fatG','carbsG','fiberG','saltG','vegetablesG'] loop
    lim := case k when 'energyKcal' then 5000 when 'carbsG' then 1000 when 'fiberG' then 200 when 'saltG' then 100 when 'vegetablesG' then 2000 else 500 end;
    if coalesce((fields->>k)::numeric,-1) not between 0 and lim then raise exception 'invalid_recipe'; end if;
  end loop;
  if r.id is null then
    insert into public.recipes(id,household_id,name,category,servings_base,cook_minutes,protein_source,meta)
    values(target_id,household,trim(fields->>'name'),'main',(fields->>'servings')::int,(fields->>'cookMinutes')::int,fields->>'proteinSource','{}');
  end if;
  update public.recipes set name=trim(fields->>'name'),servings_base=(fields->>'servings')::int,cook_minutes=(fields->>'cookMinutes')::int,protein_source=fields->>'proteinSource',
    meta=(meta - 'recipe_detail_version') || jsonb_build_object('side',fields->>'side','ingredients_text',fields->>'ingredients','steps_text',fields->>'steps','total_minutes',(fields->>'cookMinutes')::int,'editor_request_id',request_id::text)
  where id=target_id and household_id=household;
  insert into public.recipe_nutrition(recipe_id,energy_kcal,protein_g,fat_g,carbs_g,fiber_g,salt_g,vegetables_g,source)
  values(target_id,(fields->>'energyKcal')::numeric,(fields->>'proteinG')::numeric,(fields->>'fatG')::numeric,(fields->>'carbsG')::numeric,(fields->>'fiberG')::numeric,(fields->>'saltG')::numeric,(fields->>'vegetablesG')::numeric,'user_estimate')
  on conflict(recipe_id) do update set energy_kcal=excluded.energy_kcal,protein_g=excluded.protein_g,fat_g=excluded.fat_g,carbs_g=excluded.carbs_g,fiber_g=excluded.fiber_g,salt_g=excluded.salt_g,vegetables_g=excluded.vegetables_g,source=excluded.source;
  -- 材料・工程はまとめて置換する。工程に紐づくチェックはFKで解除される。
  delete from public.recipe_steps where recipe_id=target_id;
  delete from public.recipe_ingredients where recipe_id=target_id;
  insert into public.recipe_steps(recipe_id,phase,position,text)
  select target_id,phase,line.position::int-1,trim(line.text)
  from (values ('seasoning',fields->>'ingredients'),('morning',fields->>'morning'),('evening',fields->>'steps')) as sections(phase,body)
  cross join lateral regexp_split_to_table(coalesce(body,''),E'\r?\n') with ordinality as line(text,position) where trim(line.text)<>'';
  return target_id;
end $$;
revoke all on function public.household_recipe_editor(uuid) from public,anon;
revoke all on function public.save_household_recipe_editor(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.household_recipe_editor(uuid) to authenticated;
grant execute on function public.save_household_recipe_editor(uuid,uuid,text,jsonb) to authenticated;
