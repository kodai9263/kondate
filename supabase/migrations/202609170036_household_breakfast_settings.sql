-- 朝食は有効日ごとの設定と当日のレシピを分け、編集で過去の工程を変更しない。
create table public.breakfast_templates (
  key text primary key,
  item jsonb not null
);
alter table public.breakfast_templates enable row level security;
create policy "breakfast templates readable" on public.breakfast_templates for select to authenticated using (true);
grant select on public.breakfast_templates to authenticated;

insert into public.breakfast_templates (key, item) values ('A', '{"sourceKey": "A", "name": "ごはん・味噌汁・納豆・バナナ", "minutes": 10, "tasks": ["ご飯を温める", "味噌汁を温める", "納豆を出す", "バナナを切る"], "shoppingItems": ["米", "味噌汁（作り置きまたは即席）", "納豆", "バナナ"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('B', '{"sourceKey": "B", "name": "ごはん・味噌汁・目玉焼き・ミニトマト", "minutes": 12, "tasks": ["ご飯を温める", "味噌汁を温める", "目玉焼きを焼く", "ミニトマトを洗う"], "shoppingItems": ["米", "味噌汁（作り置きまたは即席）", "卵", "ミニトマト"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('C', '{"sourceKey": "C", "name": "ごはん・味噌汁・鮭フレーク・ヨーグルト", "minutes": 10, "tasks": ["ご飯を温める", "味噌汁を温める", "鮭フレークを出す", "ヨーグルトを出す"], "shoppingItems": ["米", "味噌汁（作り置きまたは即席）", "鮭フレーク", "ヨーグルト"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('D', '{"sourceKey": "D", "name": "トースト・チーズ・ヨーグルト・果物", "minutes": 10, "tasks": ["パンを焼く", "チーズをのせる", "ヨーグルトを出す", "果物を切る"], "shoppingItems": ["食パン", "スライスチーズ", "ヨーグルト", "果物"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('E', '{"sourceKey": "E", "name": "おにぎり・味噌汁・卵焼き・果物", "minutes": 12, "tasks": ["おにぎりを作る", "味噌汁を温める", "卵焼きを作る", "果物を切る"], "shoppingItems": ["米", "味噌汁（作り置きまたは即席）", "卵", "果物"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('F', '{"sourceKey": "F", "name": "しらすごはん・味噌汁・のり・ヨーグルト", "minutes": 8, "tasks": ["ご飯を温める", "味噌汁を温める", "しらすとのりを出す", "ヨーグルトを出す"], "shoppingItems": ["米", "味噌汁（作り置きまたは即席）", "しらす", "のり", "ヨーグルト"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('G', '{"sourceKey": "G", "name": "ハムチーズトースト・ゆで卵・果物", "minutes": 10, "tasks": ["ハムとチーズをのせてパンを焼く", "ゆで卵を出す", "果物を切る"], "shoppingItems": ["食パン", "ハム", "スライスチーズ", "ゆで卵", "果物"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('H', '{"sourceKey": "H", "name": "ツナマヨトースト・スープ・ヨーグルト", "minutes": 10, "tasks": ["ツナとマヨネーズを混ぜる", "パンにのせて焼く", "スープを温める", "ヨーグルトを出す"], "shoppingItems": ["食パン", "ツナ缶", "マヨネーズ", "スープ（作り置きまたは即席）", "ヨーグルト"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('I', '{"sourceKey": "I", "name": "コーンフレーク・牛乳・バナナ・チーズ", "minutes": 5, "tasks": ["コーンフレークと牛乳を用意する", "バナナを切る", "チーズを出す"], "shoppingItems": ["コーンフレーク", "牛乳", "バナナ", "スライスチーズ"]}'::jsonb);
insert into public.breakfast_templates (key, item) values ('J', '{"sourceKey": "J", "name": "お茶漬け・卵焼き・浅漬け・ヨーグルト", "minutes": 10, "tasks": ["お茶漬けを作る", "卵焼きを作る", "浅漬けを出す", "ヨーグルトを出す"], "shoppingItems": ["米", "お茶漬けの素", "卵", "浅漬け", "ヨーグルト"]}'::jsonb);

create table public.household_breakfast_versions (
  household_id uuid not null references public.households(id),
  effective_date date not null,
  revision uuid not null default gen_random_uuid(),
  enabled boolean not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 10),
  rotation_start date not null,
  legacy_rotation boolean not null default false,
  primary key (household_id, effective_date)
);

-- 無料では最初の登録者、有料では参加中の家族が利用できる。
create or replace function public.can_use_breakfast_settings()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    public.household_has_active_subscription(public.current_household_id())
    or (select id from public.profiles where household_id = public.current_household_id()
        order by created_at, id limit 1) = (select auth.uid())
  );
$$;
revoke all on function public.can_use_breakfast_settings() from public;
grant execute on function public.can_use_breakfast_settings() to authenticated;
alter table public.household_breakfast_versions enable row level security;
create policy "breakfast versions household read" on public.household_breakfast_versions
  for select to authenticated using (household_id = (select public.current_household_id()) and (select public.can_use_breakfast_settings()));
grant select on public.household_breakfast_versions to authenticated;
create policy "breakfast snapshots respect family access" on public.recipes as restrictive
  for select to authenticated using (meta ->> 'breakfast_snapshot' is distinct from 'true' or (select public.can_use_breakfast_settings()));

create or replace function public.initialize_household_breakfast(target_household uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.household_breakfast_versions (household_id, effective_date, enabled, items, rotation_start, legacy_rotation)
  select s.household_id, '0001-01-01'::date, cardinality(s.breakfast_choices) > 0,
    coalesce((select jsonb_agg(t.item || jsonb_build_object('id', gen_random_uuid()) order by t.key)
      from public.breakfast_templates t where t.key = any(s.breakfast_choices)), '[]'::jsonb),
    '2026-07-26'::date, true
  from public.household_settings s where s.household_id = target_household
  on conflict (household_id, effective_date) do nothing;
$$;
revoke all on function public.initialize_household_breakfast(uuid) from public, anon, authenticated;

create or replace function public.initialize_household_breakfast_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.initialize_household_breakfast(new.household_id);
  return new;
end;
$$;
revoke all on function public.initialize_household_breakfast_trigger() from public, anon, authenticated;
create trigger initialize_household_breakfast after insert on public.household_settings
  for each row execute function public.initialize_household_breakfast_trigger();

create or replace function public.breakfast_item_for_date(target_household uuid, target_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.household_breakfast_versions%rowtype; day_index integer;
begin
  select * into v from public.household_breakfast_versions
    where household_id = target_household and effective_date <= target_date order by effective_date desc limit 1;
  if not found or not v.enabled or jsonb_array_length(v.items) = 0 then return null; end if;
  day_index := target_date - v.rotation_start;
  if v.legacy_rotation then day_index := mod(mod(day_index, 28) + 28, 28); end if;
  return v.items -> mod(mod(day_index, jsonb_array_length(v.items)) + jsonb_array_length(v.items), jsonb_array_length(v.items));
end;
$$;
revoke all on function public.breakfast_item_for_date(uuid, date) from public, anon, authenticated;

create or replace function public.breakfast_week_items(target_household uuid, week_start date)
returns table (name text) language sql stable security definer set search_path = '' as $$
  select distinct btrim(normalize(i.name, NFKC))
  from generate_series(0, 6) d
  cross join lateral jsonb_array_elements_text(public.breakfast_item_for_date(target_household, week_start + d) -> 'shoppingItems') i(name);
$$;
revoke all on function public.breakfast_week_items(uuid, date) from public, anon, authenticated;

create or replace function public.save_household_breakfast(expected_revision uuid, settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_household uuid := public.current_household_id();
  tomorrow date := (timezone('Asia/Tokyo', now()))::date + 1;
  latest public.household_breakfast_versions%rowtype;
  entry jsonb; field_name text; field_value jsonb;
  new_revision uuid;
begin
  if not coalesce(public.can_use_breakfast_settings(), false) then raise exception 'breakfast_access_denied'; end if;
  -- 保存・当日の確定・買い物チェックを家族単位で直列化する。
  perform 1 from public.household_settings where household_id = target_household for update;
  select * into latest from public.household_breakfast_versions where household_id = target_household order by effective_date desc limit 1;
  if not found then raise exception 'breakfast_not_initialized'; end if;
  if latest.revision is distinct from expected_revision then raise exception 'breakfast_conflict'; end if;
  if settings is null or jsonb_typeof(settings) <> 'object'
    or settings - array['enabled','items'] <> '{}'::jsonb
    or jsonb_typeof(settings -> 'enabled') is distinct from 'boolean'
    or jsonb_typeof(settings -> 'items') is distinct from 'array' then raise exception 'invalid_breakfast_settings'; end if;
  if jsonb_array_length(settings -> 'items') > 10
    or ((settings ->> 'enabled')::boolean and jsonb_array_length(settings -> 'items') = 0)
    or (select count(distinct i ->> 'id') from jsonb_array_elements(settings -> 'items') i) <> jsonb_array_length(settings -> 'items') then
    raise exception 'invalid_breakfast_settings';
  end if;
  for entry in select value from jsonb_array_elements(settings -> 'items') loop
    if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry -> 'name') is distinct from 'string'
      or entry - array['id','sourceKey','name','shoppingItems','tasks','minutes'] <> '{}'::jsonb
      or jsonb_typeof(entry -> 'id') is distinct from 'string'
      or char_length(btrim(entry ->> 'name')) not between 1 and 80
      or not (entry ?& array['id','sourceKey','name','shoppingItems','tasks','minutes']) then raise exception 'invalid_breakfast_item'; end if;
    perform (entry ->> 'id')::uuid;
    if entry ->> 'id' is null or (entry ->> 'sourceKey' is not null and not exists (select 1 from public.breakfast_templates where key = entry ->> 'sourceKey')) then raise exception 'invalid_breakfast_item'; end if;
    if entry -> 'minutes' <> 'null'::jsonb and (
      jsonb_typeof(entry -> 'minutes') <> 'number' or (entry ->> 'minutes')::numeric not between 1 and 120
      or trunc((entry ->> 'minutes')::numeric) <> (entry ->> 'minutes')::numeric) then raise exception 'invalid_breakfast_item'; end if;
    foreach field_name in array array['shoppingItems','tasks'] loop
      if jsonb_typeof(entry -> field_name) is distinct from 'array' or jsonb_array_length(entry -> field_name) > 20 then raise exception 'invalid_breakfast_item'; end if;
      for field_value in select value from jsonb_array_elements(entry -> field_name) loop
        if jsonb_typeof(field_value) <> 'string' or char_length(btrim(field_value #>> '{}')) not between 1 and (case when field_name = 'tasks' then 200 else 80 end) then raise exception 'invalid_breakfast_item'; end if;
      end loop;
    end loop;
  end loop;
  if latest.enabled = (settings ->> 'enabled')::boolean and latest.items = settings -> 'items' then
    return jsonb_build_object('revision', latest.revision, 'effectiveDate', latest.effective_date, 'changed', false);
  end if;
  insert into public.household_breakfast_versions (household_id, effective_date, enabled, items, rotation_start)
    values (target_household, tomorrow, (settings ->> 'enabled')::boolean, settings -> 'items', tomorrow)
    on conflict (household_id, effective_date) do update set enabled = excluded.enabled, items = excluded.items,
      rotation_start = excluded.rotation_start, legacy_rotation = false, revision = gen_random_uuid()
    returning revision into new_revision;
  -- 外れた品のチェックをその場で解除し、再追加で古い購入済み状態を使わない。
  update public.shopping_items i set checked = false, checked_by = null
    from public.shopping_lists l where i.list_id = l.id and l.household_id = target_household
      and l.week_start + 6 >= tomorrow and i.source = 'auto' and i.category = '朝ごはん'
      and not exists (select 1 from public.breakfast_week_items(target_household, l.week_start) b where b.name = i.name);
  return jsonb_build_object('revision', new_revision, 'effectiveDate', tomorrow, 'changed', true);
end;
$$;
revoke all on function public.save_household_breakfast(uuid, jsonb) from public;
grant execute on function public.save_household_breakfast(uuid, jsonb) to authenticated;

-- 当日分は最初に確定したレシピを使い続ける。翌日以降の編集では触らない。
create or replace function public.ensure_today_breakfast(target_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_household uuid := public.current_household_id();
  target_servings integer;
  breakfast jsonb;
  breakfast_recipe uuid;
begin
  if not coalesce(public.can_use_breakfast_settings(), false) then raise exception 'breakfast_access_denied'; end if;
  if target_date is distinct from (timezone('Asia/Tokyo', now()))::date then raise exception 'invalid_plan_date'; end if;
  select default_servings into target_servings from public.household_settings where household_id = target_household for update;
  if not exists (select 1 from public.household_breakfast_versions where household_id = target_household) then raise exception 'breakfast_not_initialized'; end if;
  if exists (select 1 from public.plan_entries where household_id = target_household and date = target_date and meal_type = 'breakfast') then return; end if;
  breakfast := public.breakfast_item_for_date(target_household, target_date);
  if breakfast is null then return; end if;
  insert into public.recipes (household_id, name, category, servings_base, cook_minutes, meta)
    values (target_household, breakfast ->> 'name', 'breakfast', coalesce(target_servings, 5), coalesce((breakfast ->> 'minutes')::integer, 0),
      jsonb_build_object('breakfast_snapshot', true, 'minutes', breakfast -> 'minutes', 'breakfast_item_id', breakfast ->> 'id'))
    returning id into breakfast_recipe;
  insert into public.recipe_steps (recipe_id, phase, position, text)
    select breakfast_recipe, 'morning', ordinality::int - 1, value from jsonb_array_elements_text(breakfast -> 'tasks') with ordinality;
  insert into public.plan_entries (household_id, date, meal_type, recipe_id, servings)
    values (target_household, target_date, 'breakfast', breakfast_recipe, coalesce(target_servings, 5));
end;
$$;
revoke all on function public.ensure_today_breakfast(date) from public;
grant execute on function public.ensure_today_breakfast(date) to authenticated;

-- 旧画面との互換入口。新しい今日画面は朝食専用の入口を使う。
create or replace function public.ensure_today_plan(target_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h uuid := public.current_household_id();
  rotation_day integer := mod(mod(target_date - date '2026-07-26', 28) + 28, 28);
begin
  perform public.ensure_today_breakfast(target_date);
  insert into public.plan_entries (household_id, date, meal_type, recipe_id, servings)
    select h, target_date, 'dinner', e.recipe_id, s.default_servings
    from public.template_entries e cross join public.household_settings s
    where s.household_id = h and e.template_id = '00000000-0000-0000-0000-000000000001'
      and e.day_index = rotation_day and e.meal_type = 'dinner'
    on conflict (household_id, date, meal_type) do nothing;
end;
$$;
revoke all on function public.ensure_today_plan(date) from public;
grant execute on function public.ensure_today_plan(date) to authenticated;

-- 既存の工程編集RPCからも、確定した朝食を変更できないようにする。
create or replace function public.protect_breakfast_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_table_name = 'recipes' and old.meta ->> 'breakfast_snapshot' = 'true') then
    raise exception 'breakfast_snapshot_readonly';
  end if;
  return old;
end;
$$;
create trigger protect_breakfast_snapshot before update or delete on public.recipes
  for each row when (old.meta ->> 'breakfast_snapshot' = 'true') execute function public.protect_breakfast_snapshot();
create or replace function public.protect_breakfast_snapshot_step()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.recipes where id = old.recipe_id and meta ->> 'breakfast_snapshot' = 'true') then raise exception 'breakfast_snapshot_readonly'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_breakfast_snapshot_step before update or delete on public.recipe_steps
  for each row execute function public.protect_breakfast_snapshot_step();
revoke all on function public.protect_breakfast_snapshot() from public, anon, authenticated;
revoke all on function public.protect_breakfast_snapshot_step() from public, anon, authenticated;

-- 朝食の買い物チェックでは、古い画面から送られた不要品を拒否する。
alter function public.set_shopping_item_checked(date, text, text, integer, boolean) rename to set_shopping_item_checked_base;
revoke all on function public.set_shopping_item_checked_base(date, text, text, integer, boolean) from public, anon, authenticated;
create function public.set_shopping_item_checked(target_week_start date, target_category text, target_name text, target_position integer, target_checked boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare h uuid := public.current_household_id();
begin
  if not coalesce(public.can_use_breakfast_settings(), false) then raise exception 'breakfast_access_denied'; end if;
  if target_category = '朝ごはん' then
    perform 1 from public.household_settings where household_id = h for update;
    if not exists (select 1 from public.breakfast_week_items(h, target_week_start) where name = target_name) then raise exception 'invalid_breakfast_shopping_item'; end if;
  end if;
  return public.set_shopping_item_checked_base(target_week_start, target_category, target_name, target_position, target_checked);
end;
$$;
revoke all on function public.set_shopping_item_checked(date, text, text, integer, boolean) from public;
grant execute on function public.set_shopping_item_checked(date, text, text, integer, boolean) to authenticated;

select public.initialize_household_breakfast(household_id) from public.household_settings;
