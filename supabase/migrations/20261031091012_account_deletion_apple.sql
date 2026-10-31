-- 削除済み購入者のトークンだけを残し、遅延通知で契約を復活させない。
alter table public.apple_purchase_accounts alter column user_id drop not null;
alter table public.apple_purchase_accounts alter column household_id drop not null;
alter table public.apple_purchase_accounts add column deleted_at timestamptz;
alter table public.apple_purchase_accounts add constraint apple_account_deletion_shape
  check ((deleted_at is null and user_id is not null and household_id is not null)
      or (deleted_at is not null and user_id is null and household_id is null));
-- 退会の受付を先に確定し、認証削除が失敗しても家族データへ戻れないようにする。
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  household_id uuid,
  last_member boolean not null,
  storage_objects jsonb not null default '[]',
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
  -- Apple通知と同じ家族単位のロックで削除・取引保存の競合を防ぐ。
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_household::text, 0));
  perform 1 from public.households h where h.id = target_household for update;
  select count(*) into remaining_count from public.profiles p where p.household_id = target_household;

  insert into public.account_deletion_requests (user_id, household_id, last_member, storage_objects)
  values (target_user_id, target_household, remaining_count = 1,
    (select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name)), '[]')
     from storage.objects o where o.owner_id = target_user_id::text
       or (remaining_count = 1 and o.bucket_id='recipe-images' and starts_with(o.name,target_household::text || '/'))))
  returning * into existing;

  update public.household_invites i set revoked_at = now()
    where (created_by = target_user_id or (remaining_count = 1 and i.household_id = target_household))
      and revoked_at is null;
  update public.task_states set checked_by = null where checked_by = target_user_id;
  update public.shopping_items set checked_by = null where checked_by = target_user_id;
  update public.shopping_completions set completed_by = null where completed_by = target_user_id;

  delete from public.apple_subscription_transactions
    where app_account_token in (select token from public.apple_purchase_accounts where user_id=target_user_id);
  update public.apple_purchase_accounts set user_id=null, household_id=null, deleted_at=now(), sandbox_enabled=false
    where user_id=target_user_id;
  delete from public.household_apple_subscriptions a where a.household_id=target_household;
  insert into public.household_apple_subscriptions(household_id,plan_id,status,current_period_end)
    select target_household,t.plan_id,case when t.expires_at>now() then 'active' else 'expired' end,t.expires_at
    from public.apple_subscription_transactions t join public.apple_purchase_accounts a on a.token=t.app_account_token
    where t.household_id=target_household and a.deleted_at is null and t.revoked_at is null and not t.is_upgraded
      and (t.environment='Production' or a.sandbox_enabled) order by t.expires_at desc limit 1;
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

  if exists (select 1 from storage.objects o where o.owner_id=deletion.user_id::text
    or (deletion.last_member and o.bucket_id='recipe-images' and starts_with(o.name,deletion.household_id::text || '/'))) then
    raise exception 'storage_objects_remain';
  end if;
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
    delete from public.household_apple_subscriptions where household_id = deletion.household_id;
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
    set status = 'completed', user_id = null, storage_objects='[]',
      household_id = case when last_member then household_id else null end,
      completed_at = now()
    where id = target_request_id and status = 'pending_auth';
  if not found then raise exception 'deletion_request_not_ready'; end if;
end;
$$;

revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.complete_account_deletion(uuid) to service_role;

create or replace function public.record_apple_transaction(tx jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  account public.apple_purchase_accounts%rowtype;
  existing public.apple_subscription_transactions%rowtype;
  best public.apple_subscription_transactions%rowtype;
begin
  select * into strict account from public.apple_purchase_accounts where token = (tx->>'app_account_token')::uuid for update;
  if account.deleted_at is not null then return; end if;
  if tx->>'environment' = 'Sandbox' and not account.sandbox_enabled then
    raise exception 'sandbox_not_allowed';
  end if;
  -- 同じ家族の別購入者から届く更新も直列化する。
  perform pg_advisory_xact_lock(hashtextextended(account.household_id::text, 0));
  select * into strict account from public.apple_purchase_accounts where token=(tx->>'app_account_token')::uuid;
  if account.deleted_at is not null then return; end if;
  select * into existing from public.apple_subscription_transactions
    where environment = tx->>'environment' and original_transaction_id = tx->>'original_transaction_id' limit 1;
  if found and existing.app_account_token <> account.token then raise exception 'purchase_owner_mismatch'; end if;
  select * into existing from public.apple_subscription_transactions
    where environment = tx->>'environment' and transaction_id = tx->>'transaction_id';
  if found and (existing.app_account_token <> account.token or existing.original_transaction_id <> tx->>'original_transaction_id') then
    raise exception 'purchase_owner_mismatch';
  end if;
  insert into public.apple_subscription_transactions(environment,transaction_id,original_transaction_id,app_account_token,household_id,
    product_id,plan_id,purchased_at,expires_at,signed_at,revoked_at,is_upgraded)
  values(tx->>'environment',tx->>'transaction_id',tx->>'original_transaction_id',account.token,account.household_id,
    tx->>'product_id',tx->>'plan_id',(tx->>'purchased_at')::timestamptz,(tx->>'expires_at')::timestamptz,
    (tx->>'signed_at')::timestamptz,(tx->>'revoked_at')::timestamptz,(tx->>'is_upgraded')::boolean)
  on conflict(environment,transaction_id) do update set
    expires_at = excluded.expires_at, signed_at = excluded.signed_at, revoked_at = excluded.revoked_at,
    is_upgraded = excluded.is_upgraded, updated_at = now()
  where excluded.signed_at > apple_subscription_transactions.signed_at;
  select t.* into best from public.apple_subscription_transactions t
    join public.apple_purchase_accounts a on a.token = t.app_account_token
    where t.household_id = account.household_id and t.revoked_at is null and not t.is_upgraded
      and (t.environment = 'Production' or a.sandbox_enabled)
    order by t.expires_at desc limit 1;
  insert into public.household_apple_subscriptions(household_id,plan_id,status,current_period_end)
    values(account.household_id,coalesce(best.plan_id,'family_monthly'),
      case when best.expires_at > now() then 'active' else 'expired' end,coalesce(best.expires_at,now()))
    on conflict(household_id) do update set plan_id=excluded.plan_id,status=excluded.status,
      current_period_end=excluded.current_period_end,updated_at=now();
end;
$$;
revoke all on function public.record_apple_transaction(jsonb) from public, anon, authenticated;
grant execute on function public.record_apple_transaction(jsonb) to service_role;


-- 受付と競合した古いリクエストで購入者の対応を再作成させない。
create function public.guard_apple_purchase_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.household_id::text,0));
    if not exists(select 1 from public.profiles where id=new.user_id and household_id=new.household_id)
      or exists(select 1 from public.account_deletion_requests where user_id=new.user_id) then
      raise exception 'account_deletion_in_progress';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_apple_purchase_profile() from public,anon,authenticated;
create trigger guard_apple_purchase_profile before insert on public.apple_purchase_accounts
for each row execute function public.guard_apple_purchase_profile();
