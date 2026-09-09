alter table public.household_subscriptions
  add column if not exists monitor_started_at timestamptz;

create index if not exists household_subscriptions_monitor_started_idx
  on public.household_subscriptions (monitor_started_at)
  where monitor_started_at is not null;

create table if not exists public.monitor_trial_claims (
  id uuid primary key,
  household_id uuid unique references public.households(id) on delete cascade,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  constraint monitor_trial_claims_claimed_household_check
    check (claimed_at is null or household_id is not null)
);

alter table public.monitor_trial_claims enable row level security;

create index if not exists monitor_trial_claims_active_reservation_idx
  on public.monitor_trial_claims (expires_at)
  where household_id is null;

create or replace function public.claim_monitor_trial_slot(reservation_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  occupied_slots integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('monitor_trial_campaign_v1'));

  delete from public.monitor_trial_claims
  where household_id is null
    and expires_at <= now();

  if exists (
    select 1
    from public.monitor_trial_claims
    where id = reservation_token
      and (household_id is not null or expires_at > now())
  ) then
    return true;
  end if;

  select count(*) into occupied_slots
  from public.monitor_trial_claims
  where household_id is not null
     or expires_at > now();

  if occupied_slots >= 10 then
    return false;
  end if;

  insert into public.monitor_trial_claims (id, expires_at)
  values (reservation_token, now() + interval '15 minutes');

  return true;
end;
$$;

revoke all on function public.claim_monitor_trial_slot(uuid) from public;
grant execute on function public.claim_monitor_trial_slot(uuid) to service_role;

create or replace function public.release_monitor_trial_slot(reservation_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.monitor_trial_claims
  where id = reservation_token
    and household_id is null;

  return found;
end;
$$;

revoke all on function public.release_monitor_trial_slot(uuid) from public;
grant execute on function public.release_monitor_trial_slot(uuid) to service_role;

create or replace function public.get_monitor_campaign_status()
returns table (
  capacity integer,
  claimed integer,
  remaining integer,
  is_open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with campaign as (
    select
      count(*) filter (where household_id is not null)::integer as claimed_count,
      count(*) filter (where household_id is not null or expires_at > now())::integer as occupied_count
    from public.monitor_trial_claims
  )
  select
    10,
    claimed_count,
    greatest(10 - occupied_count, 0),
    occupied_count < 10
  from campaign;
$$;

revoke all on function public.get_monitor_campaign_status() from public;
grant execute on function public.get_monitor_campaign_status() to anon, authenticated, service_role;

create or replace function public.create_user_household(
  target_user_id uuid,
  target_email text,
  target_meta jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_household_id uuid;
  profile_name text;
  claim_token_text text;
  claim_token uuid;
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

  claim_token_text := target_meta ->> 'monitor_claim_token';
  if target_meta ->> 'signup_source' = 'monitor'
    and claim_token_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    claim_token := claim_token_text::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('monitor_trial_campaign_v1'));

    update public.monitor_trial_claims
    set household_id = created_household_id,
        claimed_at = now(),
        expires_at = now()
    where id = claim_token
      and household_id is null
      and expires_at > now();

    if found then
      update public.household_subscriptions
      set plan_id = 'family_monthly',
          status = 'trialing',
          current_period_end = now() + interval '14 days',
          cancel_at_period_end = true,
          monitor_started_at = now(),
          updated_at = now()
      where household_id = created_household_id;
    end if;
  end if;

  return created_household_id;
end;
$$;

revoke all on function public.create_user_household(uuid, text, jsonb) from public;

revoke all on table public.monitor_trial_claims from anon, authenticated;
grant select, insert, update, delete on table public.monitor_trial_claims to service_role;
