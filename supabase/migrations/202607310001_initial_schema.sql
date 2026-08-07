create extension if not exists pgcrypto;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'わが家',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  name text not null,
  is_adult boolean not null default true,
  allergies text[] not null default '{}',
  dislikes text[] not null default '{}',
  sort_order int not null default 0
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  name text not null,
  category text not null default 'main',
  servings_base int not null default 5,
  prep_minutes int not null default 0,
  cook_minutes int not null default 0,
  freezable boolean not null default false,
  bento_ok boolean not null default false,
  storage_note text,
  tags text[] not null default '{}',
  seasons text[] not null default '{}',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index recipes_official_name_idx on recipes (name) where household_id is null;

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text not null default 'other',
  position int not null default 0
);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  phase text not null check (phase in ('morning','evening')),
  position int not null,
  text text not null,
  minutes int
);

create unique index recipe_steps_unique_position_idx on recipe_steps (recipe_id, phase, position);

create table menu_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  name text not null,
  weeks int not null default 4,
  meta jsonb not null default '{}'
);

create table template_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references menu_templates(id) on delete cascade,
  day_index int not null check (day_index between 0 and 27),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  recipe_id uuid not null references recipes(id),
  unique (template_id, day_index, meal_type, recipe_id)
);

create table plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  recipe_id uuid not null references recipes(id),
  servings int,
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  unique (household_id, date, meal_type)
);

create table task_states (
  id uuid primary key default gen_random_uuid(),
  plan_entry_id uuid not null references plan_entries(id) on delete cascade,
  step_id uuid not null references recipe_steps(id) on delete cascade,
  checked_by uuid references profiles(id),
  checked_at timestamptz not null default now(),
  unique (plan_entry_id, step_id)
);

create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  week_start date not null,
  generated_at timestamptz,
  unique (household_id, week_start)
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text not null default 'other',
  source text not null default 'auto' check (source in ('auto','manual')),
  checked boolean not null default false,
  checked_by uuid references profiles(id),
  position int not null default 0
);

create table household_settings (
  household_id uuid primary key references households(id),
  default_servings int not null default 5,
  monthly_budget int,
  week_starts_on int not null default 0
);

create table seasonal_swaps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references menu_templates(id) on delete cascade,
  season text not null check (season in ('spring','summer','autumn','winter')),
  from_recipe_id uuid not null references recipes(id),
  to_recipe_id uuid not null references recipes(id),
  unique (template_id, season, from_recipe_id)
);

create table meal_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_entry_id uuid not null references plan_entries(id) on delete cascade,
  family_member_id uuid not null references family_members(id) on delete cascade,
  rating text not null check (rating in ('love','ok','no')),
  note text,
  created_at timestamptz not null default now(),
  unique (plan_entry_id, family_member_id)
);

create view v_recipe_scores as
select pe.recipe_id,
       mf.family_member_id,
       count(*) filter (where mf.rating='love') as loves,
       count(*) filter (where mf.rating='no') as nos,
       max(mf.created_at) as last_rated_at
from meal_feedback mf
join plan_entries pe on pe.id = mf.plan_entry_id
group by pe.recipe_id, mf.family_member_id;

create view v_daily_plan as
select pe.household_id,
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
             'checked', ts.id is not null
           )
           order by rs.phase, rs.position
         ) filter (where rs.id is not null),
         '[]'::jsonb
       ) as steps
from plan_entries pe
join recipes r on r.id = pe.recipe_id
left join recipe_steps rs on rs.recipe_id = r.id
left join task_states ts on ts.plan_entry_id = pe.id and ts.step_id = rs.id
group by pe.id, r.id;

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid()
$$;

create or replace function public.toggle_task(target_plan_entry_id uuid, target_step_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
begin
  select ts.id into existing_id
  from task_states ts
  join plan_entries pe on pe.id = ts.plan_entry_id
  where ts.plan_entry_id = target_plan_entry_id
    and ts.step_id = target_step_id
    and pe.household_id = public.current_household_id();

  if existing_id is null then
    insert into task_states (plan_entry_id, step_id, checked_by)
    select target_plan_entry_id, target_step_id, auth.uid()
    from plan_entries pe
    where pe.id = target_plan_entry_id
      and pe.household_id = public.current_household_id();
    return true;
  end if;

  delete from task_states where id = existing_id;
  return false;
end;
$$;

alter table households enable row level security;
alter table profiles enable row level security;
alter table family_members enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table menu_templates enable row level security;
alter table template_entries enable row level security;
alter table plan_entries enable row level security;
alter table task_states enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_items enable row level security;
alter table household_settings enable row level security;
alter table seasonal_swaps enable row level security;
alter table meal_feedback enable row level security;

create policy "household select" on households for select using (id = public.current_household_id());
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "family household members" on family_members for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "official recipes readable" on recipes for select using (household_id is null or household_id = public.current_household_id());
create policy "household recipes writable" on recipes for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "recipe ingredients readable" on recipe_ingredients for select using (exists (select 1 from recipes r where r.id = recipe_id and (r.household_id is null or r.household_id = public.current_household_id())));
create policy "recipe steps readable" on recipe_steps for select using (exists (select 1 from recipes r where r.id = recipe_id and (r.household_id is null or r.household_id = public.current_household_id())));
create policy "official templates readable" on menu_templates for select using (household_id is null or household_id = public.current_household_id());
create policy "template entries readable" on template_entries for select using (exists (select 1 from menu_templates mt where mt.id = template_id and (mt.household_id is null or mt.household_id = public.current_household_id())));
create policy "plan entries household" on plan_entries for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "task states household" on task_states for all using (exists (select 1 from plan_entries pe where pe.id = plan_entry_id and pe.household_id = public.current_household_id()));
create policy "shopping lists household" on shopping_lists for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "shopping items household" on shopping_items for all using (exists (select 1 from shopping_lists sl where sl.id = list_id and sl.household_id = public.current_household_id()));
create policy "settings household" on household_settings for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "seasonal swaps readable" on seasonal_swaps for select using (exists (select 1 from menu_templates mt where mt.id = template_id and (mt.household_id is null or mt.household_id = public.current_household_id())));
create policy "meal feedback household" on meal_feedback for all using (exists (select 1 from plan_entries pe where pe.id = plan_entry_id and pe.household_id = public.current_household_id()));
