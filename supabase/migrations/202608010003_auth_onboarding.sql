create index if not exists profiles_household_id_idx on profiles (household_id);

create or replace function public.create_user_household(
  target_user_id uuid,
  target_email text,
  target_meta jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_household_id uuid;
  profile_name text;
begin
  select household_id into created_household_id
  from public.profiles
  where id = target_user_id;

  if created_household_id is not null then
    return created_household_id;
  end if;

  profile_name := coalesce(
    nullif(trim(target_meta ->> 'display_name'), ''),
    nullif(split_part(target_email, '@', 1), ''),
    'ユーザー'
  );

  insert into public.households (name)
  values (profile_name || 'さんの家')
  returning id into created_household_id;

  insert into public.profiles (id, household_id, display_name)
  values (target_user_id, created_household_id, profile_name);

  insert into public.household_settings (household_id)
  values (created_household_id);

  insert into public.household_subscriptions (household_id)
  values (created_household_id);

  return created_household_id;
end;
$$;

revoke all on function public.create_user_household(uuid, text, jsonb) from public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_user_household(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.ensure_current_user_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user_record auth.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into auth_user_record from auth.users where id = auth.uid();
  return public.create_user_household(
    auth_user_record.id,
    auth_user_record.email,
    auth_user_record.raw_user_meta_data
  );
end;
$$;

revoke all on function public.ensure_current_user_household() from public;
grant execute on function public.ensure_current_user_household() to authenticated;

create or replace function public.prevent_profile_household_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.household_id <> old.household_id then
    raise exception 'household_id cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_household_change on public.profiles;
create trigger prevent_profile_household_change
  before update on public.profiles
  for each row execute procedure public.prevent_profile_household_change();

drop policy if exists "own profile" on public.profiles;
drop policy if exists "own profile readable" on public.profiles;
drop policy if exists "own profile editable" on public.profiles;
create policy "own profile readable" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "own profile editable" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "household editable" on public.households;
create policy "household editable" on public.households
  for update using (id = (select public.current_household_id()))
  with check (id = (select public.current_household_id()));
