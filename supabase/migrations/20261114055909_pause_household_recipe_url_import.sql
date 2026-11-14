-- 権利確認が完了するまでURL取り込みの保存を休止する。手入力の権限確認・保存は維持する。
CREATE OR REPLACE FUNCTION public.save_household_recipe_editor(target_id uuid, request_id uuid, expected_revision text, fields jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.recipes%rowtype; household uuid := public.current_household_id(); current_editor jsonb; k text; lim numeric;
begin
  if exists(select 1 from public.recipe_content_holds where recipe_id=target_id) then raise exception 'recipe_not_found'; end if;
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
  -- 古い画面や直接のRPC呼び出しでも、取り込み済み原稿を保存しない。
  if fields ? 'sourceUrl' then raise exception 'recipe_import_paused'; end if;
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
    if fields ? k and (jsonb_typeof(fields->k) is distinct from 'number' or (fields->>k)::numeric not between 0 and lim) then raise exception 'invalid_recipe'; end if;
  end loop;
  if r.id is null then
    insert into public.recipes(id,household_id,name,category,servings_base,cook_minutes,protein_source,meta)
    values(target_id,household,trim(fields->>'name'),'main',(fields->>'servings')::int,(fields->>'cookMinutes')::int,fields->>'proteinSource','{}');
  end if;
  update public.recipes set name=trim(fields->>'name'),servings_base=(fields->>'servings')::int,cook_minutes=(fields->>'cookMinutes')::int,protein_source=fields->>'proteinSource',
    meta=(meta - 'recipe_detail_version') || jsonb_build_object('side',fields->>'side','ingredients_text',fields->>'ingredients','steps_text',fields->>'steps','total_minutes',(fields->>'cookMinutes')::int,'editor_request_id',request_id::text)
      || case when fields ? 'sourceUrl' then jsonb_build_object('source_url',fields->>'sourceUrl','import_visibility','household') else '{}'::jsonb end
  where id=target_id and household_id=household;
  -- 栄養入力のない保存では既存値を保持し、新規料理は未登録のままにする。旧版の栄養付き保存も受け付ける。
  if fields ? 'energyKcal' then
    if not fields ?& array['proteinG','fatG','carbsG','fiberG','saltG','vegetablesG'] then raise exception 'invalid_recipe'; end if;
  insert into public.recipe_nutrition(recipe_id,energy_kcal,protein_g,fat_g,carbs_g,fiber_g,salt_g,vegetables_g,source)
  values(target_id,(fields->>'energyKcal')::numeric,(fields->>'proteinG')::numeric,(fields->>'fatG')::numeric,(fields->>'carbsG')::numeric,(fields->>'fiberG')::numeric,(fields->>'saltG')::numeric,(fields->>'vegetablesG')::numeric,'user_estimate')
  on conflict(recipe_id) do update set energy_kcal=excluded.energy_kcal,protein_g=excluded.protein_g,fat_g=excluded.fat_g,carbs_g=excluded.carbs_g,fiber_g=excluded.fiber_g,salt_g=excluded.salt_g,vegetables_g=excluded.vegetables_g,source=excluded.source;
  elsif fields ?| array['proteinG','fatG','carbsG','fiberG','saltG','vegetablesG'] then
    raise exception 'invalid_recipe';
  end if;
  -- 材料・工程はまとめて置換する。工程に紐づくチェックはFKで解除される。
  delete from public.recipe_steps where recipe_id=target_id;
  delete from public.recipe_ingredients where recipe_id=target_id;
  insert into public.recipe_steps(recipe_id,phase,position,text)
  select target_id,phase,line.position::int-1,trim(line.text)
  from (values ('seasoning',fields->>'ingredients'),('morning',fields->>'morning'),('evening',fields->>'steps')) as sections(phase,body)
  cross join lateral regexp_split_to_table(coalesce(body,''),E'\r?\n') with ordinality as line(text,position) where trim(line.text)<>'';
  return target_id;
end $function$
;
