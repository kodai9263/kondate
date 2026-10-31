-- Apple契約はStripe契約を上書きせず、署名済み取引ごとに保存する。
create table public.apple_purchase_accounts (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete restrict,
  sandbox_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, household_id)
);
create index apple_accounts_household on public.apple_purchase_accounts(household_id);
alter table public.apple_purchase_accounts enable row level security;
revoke all on public.apple_purchase_accounts from anon, authenticated;
grant all on public.apple_purchase_accounts to service_role;

create table public.apple_subscription_transactions (
  environment text not null check (environment in ('Production', 'Sandbox')),
  transaction_id text not null,
  original_transaction_id text not null,
  app_account_token uuid not null references public.apple_purchase_accounts(token) on delete restrict,
  household_id uuid not null references public.households(id) on delete restrict,
  product_id text not null check (product_id in ('app.kyounogohan.mobile.family.monthly','app.kyounogohan.mobile.family.yearly')),
  plan_id text not null check (plan_id in ('family_monthly','family_yearly')),
  purchased_at timestamptz not null,
  expires_at timestamptz not null,
  signed_at timestamptz not null,
  revoked_at timestamptz,
  is_upgraded boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(environment, transaction_id)
);
create index apple_transactions_account on public.apple_subscription_transactions(app_account_token);
create index apple_transactions_household on public.apple_subscription_transactions(household_id, expires_at);
create index apple_transactions_original on public.apple_subscription_transactions(environment, original_transaction_id);
alter table public.apple_subscription_transactions enable row level security;
revoke all on public.apple_subscription_transactions from anon, authenticated;
grant all on public.apple_subscription_transactions to service_role;
-- 契約の集約結果だけを公開し、取引番号や購入者トークンは公開しない。
create table public.household_apple_subscriptions (
  household_id uuid primary key references public.households(id) on delete restrict,
  plan_id text not null,
  status text not null,
  current_period_end timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.household_apple_subscriptions enable row level security;
revoke all on public.household_apple_subscriptions from anon, authenticated;
grant select on public.household_apple_subscriptions to authenticated;
grant all on public.household_apple_subscriptions to service_role;
create policy apple_subscription_household_read on public.household_apple_subscriptions for select to authenticated
  using (household_id = (select public.current_household_id()));

-- サービスロールだけが実行。競合・古い通知・別アカウントへの移動をDBでも拒否する。
create function public.record_apple_transaction(tx jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  account public.apple_purchase_accounts%rowtype;
  existing public.apple_subscription_transactions%rowtype;
  best public.apple_subscription_transactions%rowtype;
begin
  select * into strict account from public.apple_purchase_accounts where token = (tx->>'app_account_token')::uuid for update;
  if tx->>'environment' = 'Sandbox' and not account.sandbox_enabled then
    raise exception 'sandbox_not_allowed';
  end if;
  -- 同じ家族の別購入者から届く更新も直列化する。
  perform pg_advisory_xact_lock(hashtextextended(account.household_id::text, 0));
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

create view public.household_billing_access with (security_invoker=true) as
select h.id as household_id,
  case when a.status='active' and a.current_period_end>now() then a.plan_id else coalesce(s.plan_id,'free') end as plan_id,
  case when a.status='active' and a.current_period_end>now() then a.status else coalesce(s.status,'free') end as status,
  case when a.status='active' and a.current_period_end>now() then a.current_period_end else s.current_period_end end as current_period_end,
  s.stripe_customer_id, s.stripe_subscription_id,
  case when a.status='active' and a.current_period_end>now() then false else coalesce(s.cancel_at_period_end,false) end as cancel_at_period_end,
  s.monitor_started_at,
  case when a.status='active' and a.current_period_end>now() then 'apple' when s.stripe_customer_id is not null then 'stripe' else 'none' end as provider
from public.households h left join public.household_subscriptions s on s.household_id=h.id
left join public.household_apple_subscriptions a on a.household_id=h.id;
grant select on public.household_billing_access to authenticated, service_role;
revoke all on public.household_billing_access from anon;

create or replace function public.household_has_active_subscription(target_household_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_subscriptions s where s.household_id=target_household_id
    and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now()))
  or exists(select 1 from public.household_apple_subscriptions a where a.household_id=target_household_id
    and a.status='active' and a.current_period_end>now())
$$;
revoke all on function public.household_has_active_subscription(uuid) from public, anon, authenticated;
grant execute on function public.household_has_active_subscription(uuid) to service_role;
