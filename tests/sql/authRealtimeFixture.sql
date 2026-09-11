-- ローカルPostgres検証用。Auth/Realtimeの外部サービス部分だけを再現する。
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema realtime;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/'); $$;
create table auth.users (
  id uuid primary key, email text, raw_user_meta_data jsonb default '{}', is_anonymous boolean default false
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$ select current_user::text; $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('sub', auth.uid(), 'is_anonymous', coalesce(nullif(current_setting('request.jwt.claim.is_anonymous', true), '')::boolean, false));
$$;
grant usage on schema auth, public, realtime to anon, authenticated, service_role;
create table realtime.messages (extension text);
alter table realtime.messages enable row level security;
grant select on realtime.messages to authenticated;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true); $$;
create table realtime.test_broadcasts (topic text, event text, record jsonb);
create function realtime.broadcast_changes(text, text, text, text, text, record, record)
returns void language plpgsql as $$
begin
  insert into realtime.test_broadcasts values ($1, $2, to_jsonb($6));
end;
$$;
create publication supabase_realtime;
