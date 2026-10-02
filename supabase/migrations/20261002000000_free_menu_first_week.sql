-- 無料対象は家庭ごとの最初の連続7日分。利用期限は設けない。
create schema if not exists kondate_private;
revoke all on schema kondate_private from public;
grant usage on schema kondate_private to authenticated;

create table public.household_first_weeks (
  household_id uuid primary key references public.households(id) on delete cascade,
  selected_start date not null check (selected_start between date '2020-01-01' and date '2100-12-25'),
  start_date date check (start_date = selected_start),
  allergies_confirmed_at timestamptz not null default now()
);
alter table public.household_first_weeks enable row level security;
revoke all on public.household_first_weeks from anon, authenticated;
grant select on public.household_first_weeks to authenticated;
create policy "first week household read" on public.household_first_weeks for select to authenticated
  using (household_id = (select public.current_household_id()));

create table public.recipe_favorites (
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_key text not null check (recipe_key ~ '^(official:[a-z0-9-]{1,100}|community:[0-9a-f-]{36})$'),
  created_at timestamptz not null default now(),
  primary key (household_id, recipe_key)
);
alter table public.recipe_favorites enable row level security;
revoke all on public.recipe_favorites from anon, authenticated;
grant select, insert, delete on public.recipe_favorites to authenticated;
create policy "favorites own household" on public.recipe_favorites for all to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

-- 未登録に公開するのは家庭に属さない、公開中の夕食メニューだけ。
alter policy "official recipes readable" on public.recipes to authenticated;
alter policy "household recipes writable" on public.recipes to authenticated;
create policy "public dinner recipes" on public.recipes for select to anon
  using (household_id is null and archived_at is null and category <> 'breakfast');
alter policy "recipe steps readable" on public.recipe_steps to authenticated;
create policy "public dinner steps" on public.recipe_steps for select to anon
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.household_id is null and r.archived_at is null and r.category <> 'breakfast'));
grant select on public.recipes, public.recipe_steps to anon;

create function kondate_private.can_write_plan_day(h uuid, d date)
returns boolean language sql stable security invoker set search_path = '' as $$
  select h = public.current_household_id() and public.can_use_breakfast_settings() and (
    exists (select 1 from public.household_subscriptions s where s.household_id = h and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
    or exists (select 1 from public.household_first_weeks w where w.household_id = h and d between w.start_date and w.start_date + 6)
  );
$$;
revoke all on function kondate_private.can_write_plan_day(uuid,date) from public;
grant execute on function kondate_private.can_write_plan_day(uuid,date) to authenticated;

create function kondate_private.configure_first_week(start_input date, adults int, children int, allergens text[])
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.current_household_id(); w public.household_first_weeks;
begin
  if auth.uid() is null or h is null or not public.can_use_breakfast_settings() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  if start_input is null or start_input not between date '2020-01-01' and date '2100-12-25'
    or adults is null or adults not between 1 and 10 or children is null or children not between 0 and 10
    or allergens is null or cardinality(allergens) > 30 then raise exception 'invalid_setup'; end if;
  perform 1 from public.households where id = h for update;
  select * into w from public.household_first_weeks where household_id = h;
  if w.start_date is not null and w.start_date <> start_input then raise exception 'first_week_already_started'; end if;
  update public.household_settings set adult_count = adults, child_count = children, allergies = allergens where household_id = h;
  if not found then raise exception 'settings_unavailable'; end if;
  insert into public.household_first_weeks(household_id,selected_start) values (h,start_input)
    on conflict (household_id) do update set selected_start = excluded.selected_start, allergies_confirmed_at = now();
end;
$$;
revoke all on function kondate_private.configure_first_week(date,int,int,text[]) from public;
grant execute on function kondate_private.configure_first_week(date,int,int,text[]) to authenticated;
create function public.configure_first_week(start_input date, adults int, children int, allergens text[])
returns void language sql security invoker set search_path = '' as $$ select kondate_private.configure_first_week(start_input,adults,children,allergens); $$;
revoke all on function public.configure_first_week(date,int,int,text[]) from public;
grant execute on function public.configure_first_week(date,int,int,text[]) to authenticated;

create function kondate_private.save_first_week(entries jsonb, servings_input int)
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.current_household_id(); w public.household_first_weeks; n int;
begin
  if auth.uid() is null or h is null or not public.can_use_breakfast_settings() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  perform 1 from public.households where id = h for update;
  select * into w from public.household_first_weeks where household_id = h;
  if not found then raise exception 'setup_required'; end if;
  if servings_input is null or servings_input not between 1 and 20 or jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) <> 7 then raise exception 'invalid_first_week'; end if;
  select count(distinct e.date) into n from jsonb_to_recordset(entries) as e(date date, "recipeId" uuid, locked boolean, "sideMode" text, "sideDishId" uuid)
    join public.recipes r on r.id = e."recipeId" and (r.household_id is null or r.household_id = h) and r.archived_at is null and r.category <> 'breakfast'
    where e.date between w.selected_start and w.selected_start + 6 and e.locked is not null
      and coalesce(e."sideMode",'default') in ('default','none','custom')
      and ((coalesce(e."sideMode",'default') = 'custom' and exists(select 1 from public.side_dishes sd where sd.id = e."sideDishId" and sd.household_id = h and sd.archived_at is null))
        or (coalesce(e."sideMode",'default') <> 'custom' and e."sideDishId" is null));
  if n <> 7 then raise exception 'invalid_first_week'; end if;
  update public.household_first_weeks set start_date = selected_start where household_id = h and start_date is null;
  insert into public.plan_entries(household_id,date,meal_type,recipe_id,servings,status,locked,side_mode,side_dish_id)
    select h,e.date,'dinner',e."recipeId",servings_input,'planned',e.locked,coalesce(e."sideMode",'default'),e."sideDishId" from jsonb_to_recordset(entries) as e(date date,"recipeId" uuid,locked boolean,"sideMode" text,"sideDishId" uuid)
    on conflict (household_id,date,meal_type) do update set recipe_id = excluded.recipe_id,servings = excluded.servings,locked = excluded.locked,side_mode = excluded.side_mode,side_dish_id = excluded.side_dish_id;
end;
$$;
revoke all on function kondate_private.save_first_week(jsonb,int) from public;
grant execute on function kondate_private.save_first_week(jsonb,int) to authenticated;
create function public.save_first_week(entries jsonb, servings_input int)
returns void language sql security invoker set search_path = '' as $$ select kondate_private.save_first_week(entries,servings_input); $$;
revoke all on function public.save_first_week(jsonb,int) from public;
grant execute on function public.save_first_week(jsonb,int) to authenticated;

-- 既存の所有権RLSに加え、SECURITY DEFINER経由の書き込みもトリガーで検証する。
create function kondate_private.protect_plan_day()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    if current_user <> 'service_role' and not exists(select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then raise exception 'authentication_required'; end if;
  else
    if tg_op <> 'INSERT' and not coalesce(kondate_private.can_write_plan_day(old.household_id,old.date),false) then raise exception 'paid_plan_required'; end if;
    if tg_op <> 'DELETE' and not coalesce(kondate_private.can_write_plan_day(new.household_id,new.date),false) then raise exception 'paid_plan_required'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function kondate_private.protect_plan_day() from public;
create trigger first_week_plan_guard before insert or update or delete on public.plan_entries for each row execute function kondate_private.protect_plan_day();

create function kondate_private.can_write_shopping(h uuid, storage_start date)
returns boolean language sql stable security invoker set search_path = '' as $$
  select h = public.current_household_id() and public.can_use_breakfast_settings() and (
    exists(select 1 from public.household_subscriptions s where s.household_id = h and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
    or exists(select 1 from public.household_first_weeks w where w.household_id = h and w.start_date = storage_start)
  );
$$;
revoke all on function kondate_private.can_write_shopping(uuid,date) from public;
grant execute on function kondate_private.can_write_shopping(uuid,date) to authenticated;
create function kondate_private.protect_shopping()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare h uuid; d date; old_h uuid; old_d date;
begin
  if auth.uid() is null then
    if current_user <> 'service_role' and not exists(select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then raise exception 'authentication_required'; end if;
  else
    if tg_table_name = 'shopping_lists' then
      if tg_op <> 'DELETE' then h := new.household_id; d := new.week_start; end if;
      if tg_op <> 'INSERT' then old_h := old.household_id; old_d := old.week_start; end if;
    else
      if tg_op <> 'DELETE' then select household_id,week_start into h,d from public.shopping_lists where id = new.list_id; end if;
      if tg_op <> 'INSERT' then select household_id,week_start into old_h,old_d from public.shopping_lists where id = old.list_id; end if;
    end if;
    if tg_op <> 'DELETE' and not coalesce(kondate_private.can_write_shopping(h,d),false) then raise exception 'paid_plan_required'; end if;
    if tg_op <> 'INSERT' and not coalesce(kondate_private.can_write_shopping(old_h,old_d),false) then raise exception 'paid_plan_required'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function kondate_private.protect_shopping() from public;
create trigger first_week_shopping_list_guard before insert or update or delete on public.shopping_lists for each row execute function kondate_private.protect_shopping();
create trigger first_week_shopping_item_guard before insert or update or delete on public.shopping_items for each row execute function kondate_private.protect_shopping();

-- 無料リストは初回の開始日を保存キーにし、利用する日が変わっても保持する。
create function public.update_first_week_shopping(target_start date, operation text, item jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare h uuid := public.current_household_id(); list_id_input uuid; saved public.shopping_items;
begin
  perform 1 from public.households where id = h for update;
  if not exists(select 1 from public.household_first_weeks where household_id = h and start_date = target_start) then raise exception 'first_week_not_started'; end if;
  insert into public.shopping_lists(household_id,week_start,generated_at) values(h,target_start,now()) on conflict(household_id,week_start) do nothing;
  select id into list_id_input from public.shopping_lists where household_id = h and week_start = target_start;
  if operation = 'add' then
    select * into saved from public.add_manual_shopping_item(target_start,item->>'name');
    return jsonb_build_object('ok',true,'item',to_jsonb(saved));
  elsif operation = 'check' and item->>'source' = 'manual' then
    if not exists(select 1 from public.shopping_items where id = (item->>'id')::uuid and list_id = list_id_input) then raise exception 'invalid_item'; end if;
    perform public.set_manual_shopping_item_checked((item->>'id')::uuid,(item->>'checked')::boolean);
  elsif operation = 'delete' then
    if not exists(select 1 from public.shopping_items where id = (item->>'id')::uuid and list_id = list_id_input) then raise exception 'invalid_item'; end if;
    perform public.delete_manual_shopping_item((item->>'id')::uuid);
  elsif operation in ('check','dismiss') then
    if operation = 'dismiss' and item->>'category' is distinct from '調味料(在庫確認)' then raise exception 'invalid_item'; end if;
    insert into public.shopping_items(list_id,category,name,position,checked,dismissed,source)
      values(list_id_input,item->>'category',item->>'name',(item->>'position')::int,case when operation = 'check' then (item->>'checked')::boolean else false end,operation = 'dismiss','auto')
      on conflict(list_id,category,name) where source = 'auto' do update set checked = case when operation = 'check' then excluded.checked else public.shopping_items.checked end, dismissed = case when operation = 'dismiss' then true else public.shopping_items.dismissed end;
  elsif operation = 'restore' then update public.shopping_items set dismissed = false where list_id = list_id_input and source = 'auto';
  else raise exception 'invalid_operation'; end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.update_first_week_shopping(date,text,jsonb) from public;
grant execute on function public.update_first_week_shopping(date,text,jsonb) to authenticated;

create function kondate_private.protect_task_day()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare h uuid; d date;
begin
  if auth.uid() is not null then
    select household_id,date into h,d from public.plan_entries where id = case when tg_op = 'DELETE' then old.plan_entry_id else new.plan_entry_id end;
    if not coalesce(kondate_private.can_write_plan_day(h,d),false) then raise exception 'paid_plan_required'; end if;
    if tg_op = 'UPDATE' then
      select household_id,date into h,d from public.plan_entries where id = old.plan_entry_id;
      if not coalesce(kondate_private.can_write_plan_day(h,d),false) then raise exception 'paid_plan_required'; end if;
    end if;
  elsif current_user <> 'service_role' and not exists(select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then raise exception 'authentication_required';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function kondate_private.protect_task_day() from public;
create trigger first_week_task_guard before insert or update or delete on public.task_states for each row execute function kondate_private.protect_task_day();

-- 旧RPCや直接更新を使っても、無料リストの対象期間を広げられない。
create function kondate_private.protect_shopping_period()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.shopping_period_mode,new.shopping_range_start,new.shopping_range_end)
    is distinct from (old.shopping_period_mode,old.shopping_range_start,old.shopping_range_end) then
    if auth.uid() is null then
      if current_user <> 'service_role' and not exists(select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then raise exception 'authentication_required'; end if;
    elsif not exists(select 1 from public.household_subscriptions s where s.household_id = public.current_household_id()
      and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now())) then
      raise exception 'paid_plan_required';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function kondate_private.protect_shopping_period() from public;
create trigger first_week_shopping_period_guard before update of shopping_period_mode,shopping_range_start,shopping_range_end
  on public.household_settings for each row execute function kondate_private.protect_shopping_period();
