-- 退会の受付を先に確定し、認証削除が失敗しても家族データへ戻れないようにする。
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  household_id uuid,
  last_member boolean not null,
  status text not null default 'processing' check (status in ('processing', 'pending_auth', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index account_deletion_last_household_idx
  on public.account_deletion_requests (household_id) where last_member;

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update on public.account_deletion_requests to service_role;

-- 本人の操作履歴は家族の共有履歴として残し、操作者だけ匿名化する。
alter table public.shopping_completions alter column completed_by drop not null;
alter table public.shopping_completions drop constraint if exists shopping_completions_completed_by_fkey;
alter table public.shopping_completions add constraint shopping_completions_completed_by_fkey
  foreign key (completed_by) references public.profiles(id) on delete set null;
alter table public.task_states drop constraint if exists task_states_checked_by_fkey;
alter table public.task_states add constraint task_states_checked_by_fkey
  foreign key (checked_by) references public.profiles(id) on delete set null;
alter table public.shopping_items drop constraint if exists shopping_items_checked_by_fkey;
alter table public.shopping_items add constraint shopping_items_checked_by_fkey
  foreign key (checked_by) references public.profiles(id) on delete set null;

create or replace function public.prevent_deleted_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.account_deletion_requests where user_id = new.id)
    or exists (select 1 from public.account_deletion_requests
      where household_id = new.household_id and last_member and status <> 'completed') then
    raise exception 'account_deletion_in_progress';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_deleted_profile() from public, anon, authenticated;
drop trigger if exists prevent_deleted_profile on public.profiles;
create trigger prevent_deleted_profile before insert on public.profiles
  for each row execute function public.prevent_deleted_profile();

create or replace function public.begin_account_deletion(target_user_id uuid)
returns table (request_id uuid, household_id uuid, last_member boolean, status text)
language plpgsql security definer set search_path = '' as $$
declare
  existing public.account_deletion_requests%rowtype;
  target_household uuid;
  remaining_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_user_id::text));
  select * into existing from public.account_deletion_requests where user_id = target_user_id for update;
  if found then
    return query select existing.id, existing.household_id, existing.last_member, existing.status;
    return;
  end if;

  select p.household_id into target_household from public.profiles p where p.id = target_user_id;
  if target_household is null then raise exception 'profile_not_found'; end if;
  perform 1 from public.households h where h.id = target_household for update;
  select count(*) into remaining_count from public.profiles p where p.household_id = target_household;

  -- Storageの管理表は読み取りのみ。APIで移管できない所有物があれば受付前に止める。
  if exists (select 1 from storage.objects o where o.owner_id = target_user_id::text
      and (remaining_count > 1 or o.bucket_id <> 'recipe-images'
        or o.name not like target_household::text || '/%')) then
    raise exception 'storage_ownership_requires_transfer';
  end if;

  insert into public.account_deletion_requests (user_id, household_id, last_member)
  values (target_user_id, target_household, remaining_count = 1)
  returning * into existing;

  update public.household_invites set revoked_at = now()
    where (created_by = target_user_id or (remaining_count = 1 and household_id = target_household))
      and revoked_at is null;
  update public.task_states set checked_by = null where checked_by = target_user_id;
  update public.shopping_items set checked_by = null where checked_by = target_user_id;
  update public.shopping_completions set completed_by = null where completed_by = target_user_id;

  delete from public.profiles where id = target_user_id;
  return query select existing.id, existing.household_id, existing.last_member, existing.status;
end;
$$;

revoke all on function public.begin_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;

create or replace function public.finish_account_deletion_data(target_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  deletion public.account_deletion_requests%rowtype;
begin
  select * into deletion from public.account_deletion_requests where id = target_request_id for update;
  if not found then raise exception 'deletion_request_not_found'; end if;
  if deletion.status <> 'processing' then return; end if;

  if deletion.last_member then
    if exists (select 1 from storage.objects where name like deletion.household_id::text || '/%') then
      raise exception 'storage_objects_remain';
    end if;
    delete from public.shopping_completions where household_id = deletion.household_id;
    delete from public.plan_entries where household_id = deletion.household_id;
    delete from public.shopping_lists where household_id = deletion.household_id;
    delete from public.household_breakfast_versions where household_id = deletion.household_id;
    delete from public.menu_templates where household_id = deletion.household_id;
    delete from public.side_dishes where household_id = deletion.household_id;
    delete from public.family_members where household_id = deletion.household_id;
    delete from public.household_settings where household_id = deletion.household_id;
    delete from public.recipes where household_id = deletion.household_id;
    delete from public.households where id = deletion.household_id;
  end if;

  update public.account_deletion_requests set status = 'pending_auth' where id = target_request_id;
end;
$$;

revoke all on function public.finish_account_deletion_data(uuid) from public, anon, authenticated;
grant execute on function public.finish_account_deletion_data(uuid) to service_role;

create or replace function public.complete_account_deletion(target_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.account_deletion_requests
    set status = 'completed', user_id = null,
      household_id = case when last_member then household_id else null end,
      completed_at = now()
    where id = target_request_id and status = 'pending_auth';
  if not found then raise exception 'deletion_request_not_ready'; end if;
end;
$$;

revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.complete_account_deletion(uuid) to service_role;
