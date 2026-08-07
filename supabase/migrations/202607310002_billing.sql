create table household_subscriptions (
  household_id uuid primary key references households(id) on delete cascade,
  plan_id text not null default 'free',
  status text not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table household_subscriptions enable row level security;

create policy "subscription household readable" on household_subscriptions
  for select using (household_id = public.current_household_id());

create policy "subscription service role writes only" on household_subscriptions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.household_has_active_subscription(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_subscriptions hs
    where hs.household_id = target_household_id
      and hs.status in ('active', 'trialing', 'checkout_completed')
      and (hs.current_period_end is null or hs.current_period_end > now())
  )
$$;
