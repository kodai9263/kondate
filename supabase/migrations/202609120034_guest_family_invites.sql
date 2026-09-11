-- 招待を持つ端末だけを匿名認証で参加させ、既存の家族単位RLSで保護する。
alter table public.household_invites add column revoked_at timestamptz;

create index household_invites_accepted_by_idx
  on public.household_invites (accepted_by) where revoked_at is null;

-- 過去に別の家族へ移動した参加記録は、現在の所属を解除する権限に使わない。
update public.household_invites i
set revoked_at = now()
where i.accepted_by is not null and (
  not exists (select 1 from public.profiles p where p.id = i.accepted_by and p.household_id = i.household_id)
  or exists (
    select 1 from public.household_invites newer
    where newer.accepted_by = i.accepted_by
      and (newer.accepted_at, newer.id) > (i.accepted_at, i.id)
  )
);

create or replace function public.prevent_profile_household_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.household_id is distinct from old.household_id
    and current_setting('app.allow_household_transfer', true) is distinct from 'on'
  then
    raise exception 'household_id cannot be changed directly';
  end if;
  return new;
end;
$$;

-- 招待リンクの再配布・発行・解除は登録済みの招待者だけが行う。
drop policy "household invites readable" on public.household_invites;
create policy "household invites readable" on public.household_invites
  for select to authenticated using (
    household_id = (select public.current_household_id())
    and created_by = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
drop policy "household invites creatable" on public.household_invites;
create policy "household invites creatable" on public.household_invites
  for insert to authenticated with check (
    household_id = (select public.current_household_id())
    and created_by = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and accepted_at is null and accepted_by is null and revoked_at is null
    and exists (
      select 1 from public.household_subscriptions hs
      where hs.household_id = household_invites.household_id
        and hs.status in ('active', 'trialing')
        and (hs.current_period_end is null or hs.current_period_end > now())
    )
  );

create or replace function public.get_household_invite(invite_token_input uuid)
returns table (household_name text, expires_at timestamptz, accepted_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select h.name, i.expires_at, i.accepted_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  join public.household_subscriptions hs on hs.household_id = h.id
  where i.invite_token = invite_token_input and i.revoked_at is null
    and hs.status in ('active', 'trialing')
    and (hs.current_period_end is null or hs.current_period_end > now())
    and (
      (i.expires_at > now() and i.accepted_at is null)
      or (i.accepted_by = (select auth.uid()) and exists (
        select 1 from public.profiles p where p.id = (select auth.uid()) and p.household_id = i.household_id
      ))
    )
  limit 1;
$$;

-- 新規匿名ユーザーの作成トリガーと、既存ユーザーの参加RPCからのみ呼び出す。
create function public.join_household_invite(target_user_id uuid, invite_token_input uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  invitation public.household_invites%rowtype;
  previous_household_id uuid;
begin
  select * into invitation from public.household_invites
  where invite_token = invite_token_input for update;

  if invitation.id is null or invitation.revoked_at is not null then
    raise exception 'invite is invalid or revoked';
  end if;

  select household_id into previous_household_id from public.profiles
  where id = target_user_id for update;

  if invitation.accepted_by = target_user_id and previous_household_id = invitation.household_id then
    return invitation.household_id;
  end if;
  if invitation.expires_at <= now() or invitation.accepted_at is not null then
    raise exception 'invite is invalid or expired';
  end if;
  if not exists (
    select 1 from public.household_subscriptions hs
    where hs.household_id = invitation.household_id and hs.status in ('active', 'trialing')
      and (hs.current_period_end is null or hs.current_period_end > now())
  ) then
    raise exception 'family subscription required';
  end if;
  if previous_household_id = invitation.household_id then
    return invitation.household_id;
  end if;

  -- 別グループへの移動後に、古い招待者が新しい参加を解除できないようにする。
  update public.household_invites set revoked_at = now()
  where accepted_by = target_user_id and revoked_at is null;

  perform set_config('app.allow_household_transfer', 'on', true);
  if previous_household_id is null then
    insert into public.profiles (id, household_id, display_name)
    values (target_user_id, invitation.household_id, '家族');
  else
    update public.profiles set household_id = invitation.household_id where id = target_user_id;
  end if;
  perform set_config('app.allow_household_transfer', 'off', true);

  update public.household_invites set accepted_by = target_user_id, accepted_at = now()
  where id = invitation.id;
  return invitation.household_id;
end;
$$;
revoke all on function public.join_household_invite(uuid, uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invite_token_text text := new.raw_user_meta_data ->> 'family_invite_token';
begin
  if new.is_anonymous is true then
    if invite_token_text is null or invite_token_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'valid family invite required';
    end if;
    -- 無効な招待でユーザーだけが作られることを防ぎ、参加と同時に確定する。
    perform public.join_household_invite(new.id, invite_token_text::uuid);
  else
    perform public.create_user_household(new.id, new.email, new.raw_user_meta_data);
  end if;
  return new;
end;
$$;

create or replace function public.accept_household_invite(invite_token_input uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  return public.join_household_invite((select auth.uid()), invite_token_input);
end;
$$;

create function public.revoke_household_invite(invite_id_input uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  invitation public.household_invites%rowtype;
  member_profile public.profiles%rowtype;
  detached_household_id uuid;
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'registered account required';
  end if;
  select * into invitation from public.household_invites
  where id = invite_id_input for update;
  if invitation.id is null or invitation.created_by is distinct from (select auth.uid())
    or invitation.household_id is distinct from (select public.current_household_id()) then
    raise exception 'invite not found';
  end if;
  if invitation.revoked_at is not null then return; end if;

  if invitation.accepted_by is not null then
    select * into member_profile from public.profiles where id = invitation.accepted_by for update;
    if member_profile.household_id = invitation.household_id then
      if member_profile.id = (select auth.uid()) then raise exception 'cannot remove yourself'; end if;
      -- 家族の献立や履歴を消さず、対象者だけを空の個人グループへ移す。
      insert into public.households (name) values (member_profile.display_name || 'さんの家')
        returning id into detached_household_id;
      insert into public.household_settings (household_id) values (detached_household_id);
      insert into public.household_subscriptions (household_id) values (detached_household_id);
      perform set_config('app.allow_household_transfer', 'on', true);
      update public.profiles set household_id = detached_household_id where id = member_profile.id;
      perform set_config('app.allow_household_transfer', 'off', true);
    end if;
  end if;
  update public.household_invites set revoked_at = now() where id = invitation.id;
end;
$$;
revoke all on function public.revoke_household_invite(uuid) from public, anon;
grant execute on function public.revoke_household_invite(uuid) to authenticated;

-- Realtimeの認可結果は接続中に残るため、通知を現在の参加者の専用チャンネルへ送る。
drop policy "family can receive task and shopping broadcasts" on realtime.messages;
create policy "family can receive task and shopping broadcasts" on realtime.messages
for select to authenticated using (
  realtime.messages.extension = 'broadcast' and (
    exists (
      select 1 from public.plan_entries pe where pe.household_id = (select public.current_household_id())
        and (select realtime.topic()) = 'plan-entry:' || pe.id::text || ':member:' || (select auth.uid())::text
    ) or exists (
      select 1 from public.shopping_lists sl where sl.household_id = (select public.current_household_id())
        and (select realtime.topic()) = 'shopping-list:' || sl.id::text || ':member:' || (select auth.uid())::text
    )
  )
);

create or replace function public.broadcast_task_state_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare member_id uuid;
begin
  for member_id in
    select p.id from public.profiles p join public.plan_entries pe on pe.household_id = p.household_id
    where pe.id = new.plan_entry_id
  loop
    perform realtime.broadcast_changes(
      'plan-entry:' || new.plan_entry_id::text || ':member:' || member_id::text,
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  end loop;
  return null;
end;
$$;

create or replace function public.broadcast_shopping_item_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid;
  target_list_id uuid := coalesce(new.list_id, old.list_id);
begin
  for member_id in
    select p.id from public.profiles p join public.shopping_lists sl on sl.household_id = p.household_id
    where sl.id = target_list_id
  loop
    perform realtime.broadcast_changes(
      'shopping-list:' || target_list_id::text || ':member:' || member_id::text,
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  end loop;
  return null;
end;
$$;
