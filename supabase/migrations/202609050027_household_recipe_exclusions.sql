grant update (archived_at) on table public.recipes to authenticated;

create table if not exists public.household_recipe_exclusions (
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_key text not null check (char_length(recipe_key) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (household_id, recipe_key)
);

create index if not exists household_recipe_exclusions_created_by_idx
  on public.household_recipe_exclusions (created_by);

alter table public.household_recipe_exclusions enable row level security;

drop policy if exists "household recipe exclusions read" on public.household_recipe_exclusions;
create policy "household recipe exclusions read"
  on public.household_recipe_exclusions
  for select
  to authenticated
  using (household_id = (select public.current_household_id()));

drop policy if exists "household recipe exclusions insert" on public.household_recipe_exclusions;
create policy "household recipe exclusions insert"
  on public.household_recipe_exclusions
  for insert
  to authenticated
  with check (
    household_id = (select public.current_household_id())
    and created_by = (select auth.uid())
  );

grant select, insert on table public.household_recipe_exclusions to authenticated;

comment on table public.household_recipe_exclusions
  is '家庭ごとに今後の献立候補から除外する公式メニュー';
