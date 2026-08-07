create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists household_invites_household_created_idx
  on public.household_invites (household_id, created_at desc);

create index if not exists household_invites_token_active_idx
  on public.household_invites (invite_token, expires_at)
  where accepted_at is null;

alter table public.household_invites enable row level security;

create policy "household invites readable" on public.household_invites
  for select using (household_id = public.current_household_id());

create policy "household invites creatable" on public.household_invites
  for insert with check (
    household_id = public.current_household_id()
    and created_by = auth.uid()
    and accepted_at is null
    and accepted_by is null
  );

grant select, insert on table public.household_invites to authenticated;

create or replace function public.prevent_profile_household_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.household_id <> old.household_id
    and current_setting('app.allow_household_transfer', true) <> 'on'
  then
    raise exception 'household_id cannot be changed directly';
  end if;
  return new;
end;
$$;

create or replace function public.get_household_invite(invite_token_input uuid)
returns table (
  household_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select h.name, i.expires_at, i.accepted_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.invite_token = invite_token_input
    and i.expires_at > now()
    and i.accepted_at is null
  limit 1;
$$;

revoke all on function public.get_household_invite(uuid) from public;
grant execute on function public.get_household_invite(uuid) to anon, authenticated;

create or replace function public.accept_household_invite(invite_token_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.household_invites%rowtype;
  current_user_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into target_invite
  from public.household_invites
  where invite_token = invite_token_input
    and expires_at > now()
    and accepted_at is null
  for update;

  if target_invite.id is null then
    raise exception 'invite is invalid or expired';
  end if;

  perform public.ensure_current_user_household();
  select household_id into current_user_household_id
  from public.profiles
  where id = auth.uid();

  if current_user_household_id = target_invite.household_id then
    return target_invite.household_id;
  end if;

  perform set_config('app.allow_household_transfer', 'on', true);

  update public.profiles
  set household_id = target_invite.household_id
  where id = auth.uid();

  update public.household_invites
  set accepted_by = auth.uid(),
      accepted_at = now()
  where id = target_invite.id;

  return target_invite.household_id;
end;
$$;

revoke all on function public.accept_household_invite(uuid) from public;
grant execute on function public.accept_household_invite(uuid) to authenticated;

comment on table public.household_invites is '家族グループへ参加するための期限付き招待リンク';
