drop policy if exists "household profiles readable" on public.profiles;
create policy "household profiles readable" on public.profiles
  for select using (household_id = public.current_household_id());

comment on policy "household profiles readable" on public.profiles is '同じ家族グループの参加済みメンバーをアカウント画面で表示する';
