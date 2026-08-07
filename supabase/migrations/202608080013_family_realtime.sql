alter table public.task_states
  add column if not exists checked boolean not null default true;

create or replace function public.ensure_today_plan(target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid := public.current_household_id();
  rotation_day integer;
begin
  if target_household_id is null then
    raise exception 'household_not_found';
  end if;

  if target_date <> (timezone('Asia/Tokyo', now()))::date then
    raise exception 'invalid_plan_date';
  end if;

  rotation_day := mod(mod(target_date - date '2026-07-26', 28) + 28, 28);

  insert into public.plan_entries (household_id, date, meal_type, recipe_id, servings)
  select
    target_household_id,
    target_date,
    te.meal_type,
    te.recipe_id,
    coalesce(hs.default_servings, 5)
  from public.template_entries te
  left join public.household_settings hs on hs.household_id = target_household_id
  where te.template_id = '00000000-0000-0000-0000-000000000001'
    and te.day_index = rotation_day
    and te.meal_type in ('breakfast', 'dinner')
  on conflict (household_id, date, meal_type) do nothing;
end;
$$;

create or replace function public.set_task_checked(
  target_plan_entry_id uuid,
  target_step_id uuid,
  target_checked boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.plan_entries pe
    join public.recipe_steps rs on rs.recipe_id = pe.recipe_id
    where pe.id = target_plan_entry_id
      and pe.household_id = public.current_household_id()
      and rs.id = target_step_id
  ) then
    raise exception 'task_not_found';
  end if;

  insert into public.task_states (plan_entry_id, step_id, checked, checked_by, checked_at)
  values (
    target_plan_entry_id,
    target_step_id,
    target_checked,
    case when target_checked then (select auth.uid()) else null end,
    now()
  )
  on conflict (plan_entry_id, step_id)
  do update set
    checked = excluded.checked,
    checked_by = excluded.checked_by,
    checked_at = excluded.checked_at;

  return target_checked;
end;
$$;

create or replace function public.toggle_task(target_plan_entry_id uuid, target_step_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_checked boolean;
begin
  select not coalesce(ts.checked, false)
  into next_checked
  from public.plan_entries pe
  join public.recipe_steps rs on rs.recipe_id = pe.recipe_id and rs.id = target_step_id
  left join public.task_states ts on ts.plan_entry_id = pe.id and ts.step_id = rs.id
  where pe.id = target_plan_entry_id
    and pe.household_id = public.current_household_id();

  if next_checked is null then
    raise exception 'task_not_found';
  end if;

  perform public.set_task_checked(target_plan_entry_id, target_step_id, next_checked);
  return next_checked;
end;
$$;

drop view if exists public.v_daily_plan;

create view public.v_daily_plan
with (security_invoker = true)
as
select pe.id as plan_entry_id,
       pe.household_id,
       pe.date,
       pe.meal_type,
       pe.status,
       pe.servings,
       r.id as recipe_id,
       r.name as recipe_name,
       r.category,
       r.prep_minutes,
       r.cook_minutes,
       r.tags,
       r.meta,
       coalesce(
         jsonb_agg(
           jsonb_build_object(
             'id', rs.id,
             'phase', rs.phase,
             'position', rs.position,
             'text', rs.text,
             'checked', coalesce(ts.checked, false)
           )
           order by rs.phase, rs.position
         ) filter (where rs.id is not null),
         '[]'::jsonb
       ) as steps
from public.plan_entries pe
join public.recipes r on r.id = pe.recipe_id
left join public.recipe_steps rs on rs.recipe_id = r.id
left join public.task_states ts on ts.plan_entry_id = pe.id and ts.step_id = rs.id
group by pe.id, r.id;

revoke all on function public.ensure_today_plan(date) from public;
revoke all on function public.set_task_checked(uuid, uuid, boolean) from public;
revoke all on function public.toggle_task(uuid, uuid) from public;
grant execute on function public.ensure_today_plan(date) to authenticated;
grant execute on function public.set_task_checked(uuid, uuid, boolean) to authenticated;
grant execute on function public.toggle_task(uuid, uuid) to authenticated;
grant select on table public.v_daily_plan to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_states'
    ) then
      alter publication supabase_realtime add table public.task_states;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_items'
    ) then
      alter publication supabase_realtime add table public.shopping_items;
    end if;
  end if;
end;
$$;

comment on function public.ensure_today_plan(date)
  is '日本時間の当日分について公式テンプレートから家族の献立を未作成時だけ展開する';
comment on function public.set_task_checked(uuid, uuid, boolean)
  is '家族の今日タスクを明示した完了状態へ更新する';
