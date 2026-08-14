create unique index if not exists shopping_items_manual_identity_uidx
  on public.shopping_items (list_id, name)
  where source = 'manual';

create or replace function public.add_manual_shopping_item(
  target_week_start date,
  target_name text
)
returns public.shopping_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_household_id uuid := public.current_household_id();
  target_list_id uuid;
  saved_item public.shopping_items;
begin
  if target_household_id is null then
    raise exception 'household_not_found';
  end if;

  target_name := trim(target_name);
  if length(target_name) not between 1 and 200 then
    raise exception 'invalid_shopping_item';
  end if;

  insert into public.shopping_lists (household_id, week_start, generated_at)
  values (target_household_id, target_week_start, now())
  on conflict (household_id, week_start)
  do update set generated_at = coalesce(public.shopping_lists.generated_at, excluded.generated_at)
  returning id into target_list_id;

  insert into public.shopping_items (list_id, name, category, source, checked, position)
  values (
    target_list_id,
    target_name,
    '追加したもの',
    'manual',
    false,
    coalesce((select max(si.position) + 1 from public.shopping_items si where si.list_id = target_list_id and si.source = 'manual'), 0)
  )
  on conflict (list_id, name) where source = 'manual'
  do update set name = excluded.name
  returning * into saved_item;

  return saved_item;
end;
$$;

create or replace function public.set_manual_shopping_item_checked(
  target_item_id uuid,
  target_checked boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.shopping_items si
  set checked = target_checked,
      checked_by = case when target_checked then auth.uid() else null end
  from public.shopping_lists sl
  where si.id = target_item_id
    and si.list_id = sl.id
    and si.source = 'manual'
    and sl.household_id = public.current_household_id();

  if not found then
    raise exception 'shopping_item_not_found';
  end if;
  return target_checked;
end;
$$;

create or replace function public.delete_manual_shopping_item(target_item_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.shopping_items si
  using public.shopping_lists sl
  where si.id = target_item_id
    and si.list_id = sl.id
    and si.source = 'manual'
    and sl.household_id = public.current_household_id();

  if not found then
    raise exception 'shopping_item_not_found';
  end if;
  return true;
end;
$$;

create or replace function public.broadcast_shopping_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_list_id uuid := coalesce(new.list_id, old.list_id);
begin
  perform realtime.broadcast_changes(
    'shopping-list:' || target_list_id::text,
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
after insert or update or delete on public.shopping_items
for each row execute function public.broadcast_shopping_item_changes();

revoke all on function public.add_manual_shopping_item(date, text) from public;
revoke all on function public.set_manual_shopping_item_checked(uuid, boolean) from public;
revoke all on function public.delete_manual_shopping_item(uuid) from public;
grant execute on function public.add_manual_shopping_item(date, text) to authenticated;
grant execute on function public.set_manual_shopping_item_checked(uuid, boolean) to authenticated;
grant execute on function public.delete_manual_shopping_item(uuid) to authenticated;

comment on function public.add_manual_shopping_item(date, text)
  is '家族の週次買い物リストへ手動品目を重複なく追加する';
comment on function public.delete_manual_shopping_item(uuid)
  is '家族が追加した買い物品目だけを削除する';
