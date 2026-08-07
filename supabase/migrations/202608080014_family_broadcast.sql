drop policy if exists "family can receive task and shopping broadcasts" on realtime.messages;

create policy "family can receive task and shopping broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    exists (
      select 1
      from public.plan_entries pe
      where pe.household_id = public.current_household_id()
        and (select realtime.topic()) = 'plan-entry:' || pe.id::text
    )
    or exists (
      select 1
      from public.shopping_lists sl
      where sl.household_id = public.current_household_id()
        and (select realtime.topic()) = 'shopping-list:' || sl.id::text
    )
  )
);

create or replace function public.broadcast_task_state_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'plan-entry:' || new.plan_entry_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

drop trigger if exists broadcast_task_state_changes_trigger on public.task_states;
create trigger broadcast_task_state_changes_trigger
after insert or update on public.task_states
for each row execute function public.broadcast_task_state_changes();

create or replace function public.broadcast_shopping_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'shopping-list:' || new.list_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

drop trigger if exists broadcast_shopping_item_changes_trigger on public.shopping_items;
create trigger broadcast_shopping_item_changes_trigger
after insert or update on public.shopping_items
for each row execute function public.broadcast_shopping_item_changes();

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_states'
  ) then
    alter publication supabase_realtime drop table public.task_states;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_items'
  ) then
    alter publication supabase_realtime drop table public.shopping_items;
  end if;
end;
$$;

comment on function public.broadcast_task_state_changes()
  is '今日タスク変更を献立単位の家族専用Realtimeチャンネルへ送る';
comment on function public.broadcast_shopping_item_changes()
  is '買い物チェック変更をリスト単位の家族専用Realtimeチャンネルへ送る';
