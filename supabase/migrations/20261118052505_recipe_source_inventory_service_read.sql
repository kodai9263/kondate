-- 管理者確認後の出典一覧取得に必要な列だけ、サーバー専用ロールへ許可する。
grant select (id, name, household_id, archived_at, meta) on public.recipes to service_role;
