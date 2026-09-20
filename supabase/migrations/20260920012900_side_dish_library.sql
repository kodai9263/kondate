create table public.side_dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  ingredients_text text not null default '' check (char_length(ingredients_text) <= 4000),
  steps_text text not null default '' check (char_length(steps_text) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index side_dishes_household_active_idx
  on public.side_dishes (household_id, created_at desc)
  where archived_at is null;

alter table public.side_dishes enable row level security;
create policy "side dishes household"
  on public.side_dishes for all to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

grant select, insert, update, delete on table public.side_dishes to authenticated;

alter table public.plan_entries
  add column side_mode text not null default 'default'
    check (side_mode in ('default', 'none', 'custom')),
  add column side_dish_id uuid references public.side_dishes(id) on delete restrict,
  add constraint plan_entries_side_selection_valid check (
    (side_mode = 'custom' and side_dish_id is not null)
    or (side_mode in ('default', 'none') and side_dish_id is null)
  );

create index plan_entries_side_dish_id_idx
  on public.plan_entries (side_dish_id)
  where side_dish_id is not null;

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
       pe.side_mode,
       case when pe.side_mode = 'custom' then jsonb_build_object(
         'id', sd.id,
         'name', sd.name,
         'ingredients_text', sd.ingredients_text,
         'steps_text', sd.steps_text
       ) else null end as side_dish,
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
left join public.side_dishes sd
  on sd.id = pe.side_dish_id
 and sd.household_id = pe.household_id
 and sd.archived_at is null
left join public.recipe_steps rs on rs.recipe_id = r.id
left join public.task_states ts on ts.plan_entry_id = pe.id and ts.step_id = rs.id
group by pe.id, r.id, sd.id;

grant select on table public.v_daily_plan to authenticated;

comment on table public.side_dishes is '家庭ごとの自作副菜ライブラリ';
comment on column public.plan_entries.side_mode is '標準副菜(default)、副菜なし(none)、自作副菜(custom)';
