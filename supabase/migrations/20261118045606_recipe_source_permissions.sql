-- 管理者は運用時に一人だけ指定する。未設定なら誰にも権限を与えない。
create table public.recipe_permission_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.recipe_permission_owner enable row level security;
revoke all on public.recipe_permission_owner from anon, authenticated;
grant select on public.recipe_permission_owner to authenticated;
grant all on public.recipe_permission_owner to service_role;
create policy "owner can check own access" on public.recipe_permission_owner
for select to authenticated using (user_id = (select auth.uid()));

-- 公開可能な出典だけを保持する。承諾情報はmetaにもこのテーブルにも入れない。
create table public.recipe_sources (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  provider_name text not null default '' check (length(provider_name) <= 160),
  author_name text not null default '' check (length(author_name) <= 160),
  source_url text not null default '' check (length(source_url) <= 2000 and (source_url = '' or source_url ~ '^https?://')),
  video_start_seconds integer check (video_start_seconds between 0 and 86400),
  updated_at timestamptz not null default now()
);
alter table public.recipe_sources enable row level security;
revoke all on public.recipe_sources from anon, authenticated;

grant select on public.recipe_sources to anon, authenticated;
grant insert, update on public.recipe_sources to authenticated;
grant all on public.recipe_sources to service_role;
create policy "visible recipe sources" on public.recipe_sources for select to anon, authenticated
using (exists(select 1 from public.recipes r where r.id = recipe_sources.recipe_id));
create policy "owner reads sources" on public.recipe_sources for select to authenticated
using (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())));
create policy "owner inserts sources" on public.recipe_sources for insert to authenticated
with check (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())));
create policy "owner updates sources" on public.recipe_sources for update to authenticated
using (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())))
with check (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())));

create table public.recipe_source_permissions (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  status text not null default 'unreviewed' check (status in ('unreviewed', 'requested', 'approved', 'denied')),
  allowed_scope text not null default '' check (length(allowed_scope) <= 4000),
  checked_on date,
  evidence text not null default '' check (length(evidence) <= 8000),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or (length(trim(allowed_scope)) > 0 and checked_on is not null and length(trim(evidence)) > 0))
);
alter table public.recipe_source_permissions enable row level security;
revoke all on public.recipe_source_permissions from anon, authenticated;
grant select, insert, update on public.recipe_source_permissions to authenticated;
grant all on public.recipe_source_permissions to service_role;
create policy "owner reads permissions" on public.recipe_source_permissions for select to authenticated
using (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())));
create policy "owner inserts permissions" on public.recipe_source_permissions for insert to authenticated
with check (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())));
create policy "owner updates permissions" on public.recipe_source_permissions for update to authenticated
using (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())))
with check (exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())));

-- 出典と承諾記録を一緒に保存する。呼び出し元の権限とRLSを維持する。
create function public.save_recipe_source_permission(target_id uuid, source_fields jsonb, permission_fields jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.recipe_permission_owner where user_id = (select auth.uid())) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  insert into public.recipe_sources (recipe_id, provider_name, author_name, source_url, video_start_seconds)
  values (target_id, source_fields->>'provider_name', source_fields->>'author_name', source_fields->>'source_url', (source_fields->>'video_start_seconds')::integer)
  on conflict (recipe_id) do update set provider_name=excluded.provider_name, author_name=excluded.author_name,
    source_url=excluded.source_url, video_start_seconds=excluded.video_start_seconds, updated_at=now();
  insert into public.recipe_source_permissions (recipe_id, status, allowed_scope, checked_on, evidence)
  values (target_id, permission_fields->>'status', permission_fields->>'allowed_scope', (permission_fields->>'checked_on')::date, permission_fields->>'evidence')
  on conflict (recipe_id) do update set status=excluded.status, allowed_scope=excluded.allowed_scope,
    checked_on=excluded.checked_on, evidence=excluded.evidence, updated_at=now();
end;
$$;
revoke all on function public.save_recipe_source_permission(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_recipe_source_permission(uuid,jsonb,jsonb) to authenticated;
-- 既存のsource_urlは画面側で参照し、不明な作者や承諾状態を推測して埋めない。
