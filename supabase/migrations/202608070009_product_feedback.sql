create table if not exists public.meal_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  served_on date not null,
  recipe_name text not null check (char_length(recipe_name) between 1 and 120),
  rating text not null check (rating in ('love', 'ok', 'avoid')),
  reason text check (reason is null or reason in ('family_loved', 'easy', 'too_much', 'too_little', 'too_slow', 'taste')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id, served_on, recipe_name)
);

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'improvement', 'praise')),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists meal_preferences_household_recipe_idx
  on public.meal_preferences (household_id, recipe_name, updated_at desc);
create index if not exists meal_preferences_user_id_idx
  on public.meal_preferences (user_id);
create index if not exists app_feedback_household_status_idx
  on public.app_feedback (household_id, status, created_at desc);
create index if not exists app_feedback_user_id_idx
  on public.app_feedback (user_id);

alter table public.meal_preferences enable row level security;
alter table public.app_feedback enable row level security;

create policy "meal preferences household read" on public.meal_preferences
  for select using (household_id = public.current_household_id());
create policy "meal preferences own insert" on public.meal_preferences
  for insert with check (household_id = public.current_household_id() and user_id = auth.uid());
create policy "meal preferences own update" on public.meal_preferences
  for update using (household_id = public.current_household_id() and user_id = auth.uid())
  with check (household_id = public.current_household_id() and user_id = auth.uid());

create policy "app feedback own read" on public.app_feedback
  for select using (household_id = public.current_household_id() and user_id = auth.uid());
create policy "app feedback own insert" on public.app_feedback
  for insert with check (household_id = public.current_household_id() and user_id = auth.uid());

grant select, insert, update on table public.meal_preferences to authenticated;
grant select, insert on table public.app_feedback to authenticated;

comment on table public.meal_preferences is '日々の献立評価と自動献立への好み反映';
comment on table public.app_feedback is '不具合、改善要望、好意的な意見を運営が確認するための投稿';
