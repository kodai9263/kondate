-- 登録から336時間の無料体験。献立の日付・設定・解約による延長はしない。
create table public.household_free_trials (
  household_id uuid primary key references public.households(id) on delete cascade,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  constraint free_trial_fourteen_days check (expires_at = started_at + interval '336 hours')
);
alter table public.household_free_trials enable row level security;
revoke all on public.household_free_trials from public, anon, authenticated;
grant select on public.household_free_trials to authenticated;
create policy "free trial household read" on public.household_free_trials for select to authenticated
  using (household_id = (select public.current_household_id()));

-- 既存家庭には移行時点から14日間を付与する。契約や保存済みデータは変更しない。
insert into public.household_free_trials(household_id,started_at,expires_at)
  select id,now(),now() + interval '336 hours' from public.households;

create function kondate_private.initialize_free_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_free_trials(household_id,started_at,expires_at)
    values(new.id,new.created_at,new.created_at + interval '336 hours');
  return new;
end;
$$;
revoke all on function kondate_private.initialize_free_trial() from public, anon, authenticated;
create trigger initialize_free_trial after insert on public.households
  for each row execute function kondate_private.initialize_free_trial();

create function kondate_private.has_planning_access(h uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and h = public.current_household_id() and public.can_use_breakfast_settings() and (
    exists(select 1 from public.household_subscriptions s where s.household_id = h
      and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
    or (not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
      and exists(select 1 from public.household_free_trials t where t.household_id = h and t.started_at <= now() and t.expires_at > now())
      and exists(select 1 from public.household_first_weeks w where w.household_id = h))
  );
$$;
revoke all on function kondate_private.has_planning_access(uuid) from public;
grant execute on function kondate_private.has_planning_access(uuid) to authenticated;

create or replace function kondate_private.can_write_plan_day(h uuid, d date)
returns boolean language sql stable security invoker set search_path = '' as $$
  select d is not null and kondate_private.has_planning_access(h);
$$;
create or replace function kondate_private.can_write_shopping(h uuid, storage_start date)
returns boolean language sql stable security invoker set search_path = '' as $$
  select storage_start is not null and kondate_private.has_planning_access(h);
$$;

create or replace function kondate_private.configure_first_week(start_input date, adults int, children int, allergens text[])
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.current_household_id(); w public.household_first_weeks;
begin
  if auth.uid() is null or h is null or not public.can_use_breakfast_settings() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  if start_input is null or start_input not between date '2020-01-01' and date '2100-12-25'
    or adults is null or adults not between 1 and 10 or children is null or children not between 0 and 10
    or allergens is null or cardinality(allergens) > 30 then raise exception 'invalid_setup'; end if;
  perform 1 from public.households where id = h for update;
  select * into w from public.household_first_weeks where household_id = h;
  update public.household_settings set adult_count = adults, child_count = children, allergies = allergens where household_id = h;
  if not found then raise exception 'settings_unavailable'; end if;
  insert into public.household_first_weeks(household_id,selected_start) values (h,start_input)
    on conflict (household_id) do update set selected_start = coalesce(public.household_first_weeks.start_date,excluded.selected_start), allergies_confirmed_at = now();
end;
$$;

create or replace function kondate_private.save_first_week(entries jsonb, servings_input int)
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.current_household_id(); w public.household_first_weeks; n int; first_date date;
begin
  if auth.uid() is null or h is null or not public.can_use_breakfast_settings() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  perform 1 from public.households where id = h for update;
  select * into w from public.household_first_weeks where household_id = h;
  if not found then raise exception 'setup_required'; end if;
  if not coalesce(kondate_private.has_planning_access(h),false) then raise exception 'paid_plan_required'; end if;
  if servings_input is null or servings_input not between 1 and 20 or jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) <> 7 then raise exception 'invalid_first_week'; end if;
  select min(e.date) into first_date from jsonb_to_recordset(entries) as e(date date);
  select count(distinct e.date) into n from jsonb_to_recordset(entries) as e(date date, "recipeId" uuid, locked boolean, "sideMode" text, "sideDishId" uuid)
    join public.recipes r on r.id = e."recipeId" and (r.household_id is null or r.household_id = h) and r.archived_at is null and r.category <> 'breakfast'
    where e.date between first_date and first_date + 6 and e.locked is not null
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

create or replace function public.update_first_week_shopping(target_start date, operation text, item jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare h uuid := public.current_household_id(); list_id_input uuid; saved public.shopping_items;
begin
  if not coalesce(kondate_private.has_planning_access(h),false) then raise exception 'paid_plan_required'; end if;
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

create or replace function kondate_private.protect_shopping_period()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.shopping_period_mode,new.shopping_range_start,new.shopping_range_end)
    is distinct from (old.shopping_period_mode,old.shopping_range_start,old.shopping_range_end) then
    if auth.uid() is null then
      if current_user <> 'service_role' and not exists(select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then raise exception 'authentication_required'; end if;
    elsif not coalesce(kondate_private.has_planning_access(public.current_household_id()),false) then
      raise exception 'paid_plan_required';
    end if;
  end if;
  return new;
end;
$$;

-- 完了履歴の直接変更も体験終了後は拒否する。読み取り・データ保持は継続。
create function kondate_private.protect_shopping_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    if current_user <> 'service_role' and not exists(select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then raise exception 'authentication_required'; end if;
  else
    if tg_op <> 'INSERT' and not coalesce(kondate_private.has_planning_access(old.household_id),false) then raise exception 'paid_plan_required'; end if;
    if tg_op <> 'DELETE' and not coalesce(kondate_private.has_planning_access(new.household_id),false) then raise exception 'paid_plan_required'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function kondate_private.protect_shopping_completion() from public;
create trigger free_trial_completion_guard before insert or update or delete on public.shopping_completions
  for each row execute function kondate_private.protect_shopping_completion();
