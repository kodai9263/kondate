-- 原本と予定は保持し、確認待ちの本文をクライアントへ配信しない。
create table public.recipe_content_holds (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  recipe_name text not null,
  review_key text not null,
  held_at timestamptz not null default now()
);
alter table public.recipe_content_holds enable row level security;
create index recipe_content_holds_household_idx on public.recipe_content_holds(household_id);
revoke all on public.recipe_content_holds from anon, authenticated;
grant select on public.recipe_content_holds to anon, authenticated;
grant all on public.recipe_content_holds to service_role;
create policy "content holds visible to relevant household" on public.recipe_content_holds for select to authenticated
using (household_id is null or household_id=(select public.current_household_id()));
create policy "public content holds" on public.recipe_content_holds for select to anon using (household_id is null);
create policy "hold unreviewed recipe content" on public.recipes as restrictive for all to anon, authenticated
using (not exists(select 1 from public.recipe_content_holds h where h.recipe_id=recipes.id))
with check (not exists(select 1 from public.recipe_content_holds h where h.recipe_id=recipes.id));
create policy "held recipe children are inaccessible" on public.recipe_steps as restrictive for all to anon, authenticated
using (exists(select 1 from public.recipes r where r.id=recipe_steps.recipe_id))
with check (exists(select 1 from public.recipes r where r.id=recipe_steps.recipe_id));
create policy "held recipe children are inaccessible" on public.recipe_ingredients as restrictive for all to anon, authenticated
using (exists(select 1 from public.recipes r where r.id=recipe_ingredients.recipe_id))
with check (exists(select 1 from public.recipes r where r.id=recipe_ingredients.recipe_id));
create policy "held recipe children are inaccessible" on public.recipe_nutrition as restrictive for all to anon, authenticated
using (exists(select 1 from public.recipes r where r.id=recipe_nutrition.recipe_id))
with check (exists(select 1 from public.recipes r where r.id=recipe_nutrition.recipe_id));

-- SECURITY DEFINERの編集経路でも本文の配信制限を確認する。
CREATE OR REPLACE FUNCTION public.household_recipe_editor(target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.recipes%rowtype; fields jsonb; n public.recipe_nutrition%rowtype;
begin
  if exists(select 1 from public.recipe_content_holds where recipe_id=target_id) then raise exception 'recipe_not_found'; end if;
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
end $function$
;

-- SECURITY DEFINERの編集経路でも本文の配信制限を確認する。
CREATE OR REPLACE FUNCTION public.reset_recipe_step_customization(target_recipe_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_household_id uuid := public.current_household_id();
  customized_recipe_id uuid;
begin
  if exists(select 1 from public.recipe_content_holds where recipe_id=target_recipe_id) then raise exception 'recipe_not_found'; end if;
  if target_household_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.recipes
    where id = target_recipe_id
      and household_id is null
      and archived_at is null
  ) then
    raise exception 'official recipe not found';
  end if;

  select id into customized_recipe_id
  from public.recipes
  where household_id = target_household_id
    and archived_at is null
    and meta ->> 'step_customization' = 'true'
    and meta ->> 'source_recipe_id' = target_recipe_id::text
  limit 1;

  if customized_recipe_id is null then
    return false;
  end if;

  update public.plan_entries
  set recipe_id = target_recipe_id
  where household_id = target_household_id
    and recipe_id = customized_recipe_id
    and date >= (timezone('Asia/Tokyo', now()))::date;

  update public.recipes
  set archived_at = now()
  where id = customized_recipe_id
    and household_id = target_household_id;

  return true;
end;
$function$
;

-- SECURITY DEFINERの編集経路でも本文の配信制限を確認する。
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

-- SECURITY DEFINERの編集経路でも本文の配信制限を確認する。
CREATE OR REPLACE FUNCTION public.save_recipe_step_customization(target_recipe_id uuid, morning_steps_text text, evening_steps_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_household_id uuid := public.current_household_id();
  source_recipe public.recipes%rowtype;
  customized_recipe_id uuid;
begin
  if exists(select 1 from public.recipe_content_holds where recipe_id=target_recipe_id) then raise exception 'recipe_not_found'; end if;
  if target_household_id is null then
    raise exception 'authentication required';
  end if;

  select * into source_recipe
  from public.recipes
  where id = target_recipe_id
    and archived_at is null;

  if not found or (source_recipe.household_id is not null and source_recipe.household_id <> target_household_id) then
    raise exception 'recipe not found';
  end if;

  if source_recipe.household_id is null then
    select id into customized_recipe_id
    from public.recipes
    where household_id = target_household_id
      and archived_at is null
      and meta ->> 'step_customization' = 'true'
      and meta ->> 'source_recipe_id' = target_recipe_id::text
    limit 1;

    if customized_recipe_id is null then
      insert into public.recipes (
        household_id, name, category, servings_base, prep_minutes, cook_minutes,
        freezable, bento_ok, storage_note, tags, seasons, meta, image_url, protein_source
      ) values (
        target_household_id, source_recipe.name, source_recipe.category, source_recipe.servings_base,
        source_recipe.prep_minutes, source_recipe.cook_minutes, source_recipe.freezable,
        source_recipe.bento_ok, source_recipe.storage_note, source_recipe.tags, source_recipe.seasons,
        source_recipe.meta || jsonb_build_object(
          'step_customization', true,
          'source_recipe_id', source_recipe.id::text
        ),
        source_recipe.image_url, source_recipe.protein_source
      ) returning id into customized_recipe_id;

      insert into public.recipe_nutrition (
        recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
        fiber_g, salt_g, vegetables_g, source
      )
      select customized_recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
             fiber_g, salt_g, vegetables_g, source
      from public.recipe_nutrition
      where recipe_id = target_recipe_id;

      insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category, position)
      select customized_recipe_id, name, quantity, unit, category, position
      from public.recipe_ingredients
      where recipe_id = target_recipe_id;

      insert into public.recipe_steps (recipe_id, phase, position, text, minutes)
      select customized_recipe_id, phase, position, text, minutes
      from public.recipe_steps
      where recipe_id = target_recipe_id
        and phase = 'seasoning';
    end if;

    update public.plan_entries
    set recipe_id = customized_recipe_id
    where household_id = target_household_id
      and recipe_id = target_recipe_id
      and date >= (timezone('Asia/Tokyo', now()))::date;
  else
    customized_recipe_id := target_recipe_id;
  end if;

  delete from public.recipe_steps
  where recipe_id = customized_recipe_id
    and phase in ('morning', 'evening');

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select customized_recipe_id, 'morning', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(coalesce(morning_steps_text, ''), E'\\r?\\n')
    with ordinality as line(text, position)
  where trim(line.text) <> '';

  insert into public.recipe_steps (recipe_id, phase, position, text)
  select customized_recipe_id, 'evening', line.position::int - 1, trim(line.text)
  from regexp_split_to_table(coalesce(evening_steps_text, ''), E'\\r?\\n')
    with ordinality as line(text, position)
  where trim(line.text) <> '';

  return customized_recipe_id;
end;
$function$
;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_community_recipe'
  loop execute format('revoke all on function %s from public, anon, authenticated, service_role', f.signature); end loop;
end $$;


revoke all on function public.household_recipe_editor(uuid) from public, anon;
revoke all on function public.save_household_recipe_editor(uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.save_recipe_step_customization(uuid,text,text) from public, anon;
revoke all on function public.reset_recipe_step_customization(uuid) from public, anon;
grant execute on function public.household_recipe_editor(uuid), public.save_household_recipe_editor(uuid,uuid,text,jsonb), public.save_recipe_step_customization(uuid,text,text), public.reset_recipe_step_customization(uuid) to authenticated;
