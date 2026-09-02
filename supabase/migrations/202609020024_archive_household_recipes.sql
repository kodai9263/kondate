alter table public.recipes
  add column if not exists archived_at timestamptz;

create index if not exists recipes_household_active_idx
  on public.recipes (household_id, created_at desc)
  where archived_at is null;
