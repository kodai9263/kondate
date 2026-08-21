-- Stripe Webhookが購読状態を同期するために必要な操作だけを許可する。
grant select, insert, update on table public.household_subscriptions to service_role;
