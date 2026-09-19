-- 期間の選択を家庭で共有する。週次リストの手動品と購入済み状態は維持する。
alter table public.household_settings
  add column shopping_period_mode text not null default 'week',
  add column shopping_range_start date,
  add column shopping_range_end date,
  add constraint household_shopping_period_check check (
    (shopping_period_mode in ('today', 'week') and shopping_range_start is null and shopping_range_end is null)
    or (shopping_period_mode = 'custom' and shopping_range_start is not null and shopping_range_end is not null
      and shopping_range_start >= date '0001-01-01' and shopping_range_end <= date '9999-12-31'
      and shopping_range_end >= shopping_range_start and shopping_range_end - shopping_range_start < 366)
  );

create or replace function public.update_planned_shopping(
  target_week_start date,
  expected_range_start date,
  expected_range_end date,
  expected_period_mode text,
  operation text,
  item jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  household uuid := public.current_household_id();
  today date := (timezone('Asia/Tokyo', now()))::date;
  settings public.household_settings;
  cycle_start date;
  storage_start date;
  current_start date;
  current_end date;
  new_start date;
  new_end date;
  new_mode text;
  current_list public.shopping_lists;
  result jsonb;
begin
  if household is null then raise exception 'household_not_found'; end if;
  -- 期間変更と品目保存を同じ家庭設定のロックで直列化する。
  select * into settings from public.household_settings hs where hs.household_id = household for update;
  if not found then raise exception 'shopping_settings_unavailable'; end if;
  cycle_start := today - ((extract(dow from today)::integer - settings.shopping_day + 7) % 7);
  storage_start := cycle_start + ((7 - settings.shopping_day) % 7);
  if target_week_start is distinct from storage_start then raise exception 'shopping_period_changed'; end if;
  if operation not in ('period', 'check', 'add', 'delete', 'dismiss', 'restore') or operation is null then
    raise exception 'invalid_shopping_operation';
  end if;

  insert into public.shopping_lists (household_id, week_start, generated_at)
  values (household, storage_start, now()) on conflict (household_id, week_start) do nothing;
  select * into current_list from public.shopping_lists sl
    where sl.household_id = household and sl.week_start = storage_start for update;
  current_start := case settings.shopping_period_mode when 'today' then today when 'custom' then settings.shopping_range_start else cycle_start end;
  current_end := case settings.shopping_period_mode when 'today' then today when 'custom' then settings.shopping_range_end else cycle_start + 6 end;
  if expected_range_start is distinct from current_start or expected_range_end is distinct from current_end
    or expected_period_mode is distinct from settings.shopping_period_mode then raise exception 'shopping_period_changed'; end if;

  if operation = 'period' then
    new_mode := item->>'mode';
    if new_mode is null or new_mode not in ('today', 'week', 'custom') then raise exception 'invalid_shopping_range'; end if;
    if new_mode = 'custom' then
      if coalesce(item->>'start', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'end', '') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'invalid_shopping_range';
      end if;
      begin
        new_start := (item->>'start')::date;
        new_end := (item->>'end')::date;
      exception when datetime_field_overflow or invalid_datetime_format then raise exception 'invalid_shopping_range';
      end;
      if new_start < date '0001-01-01' or new_end > date '9999-12-31' or new_end < new_start or new_end - new_start >= 366 then
        raise exception 'invalid_shopping_range';
      end if;
    end if;
    update public.household_settings set shopping_period_mode = new_mode, shopping_range_start = new_start, shopping_range_end = new_end
      where household_id = household;
    return jsonb_build_object('ok', true);
  end if;

  if operation = 'add' then
    select to_jsonb(saved) into result from public.add_manual_shopping_item(storage_start, item->>'name') saved;
    return jsonb_build_object('ok', true, 'item', result);
  end if;
  if operation = 'delete' or (operation = 'check' and item->>'source' = 'manual') then
    if not exists (select 1 from public.shopping_items si
      where si.id = (item->>'id')::uuid and si.list_id = current_list.id and si.source = 'manual') then
      raise exception 'shopping_item_not_found';
    end if;
    if operation = 'delete' then perform public.delete_manual_shopping_item((item->>'id')::uuid);
    else perform public.set_manual_shopping_item_checked((item->>'id')::uuid, (item->>'checked')::boolean);
    end if;
    return jsonb_build_object('ok', true);
  end if;
  if operation = 'restore' then
    update public.shopping_items set dismissed = false where list_id = current_list.id and source = 'auto' and dismissed;
    return jsonb_build_object('ok', true);
  end if;
  if operation = 'dismiss' then
    if item->>'category' is distinct from '調味料(在庫確認)' then raise exception 'invalid_shopping_item'; end if;
    perform public.dismiss_seasoning_shopping_item(storage_start, item->>'name', (item->>'position')::integer);
  else
    perform public.set_shopping_item_checked(storage_start, item->>'category', item->>'name', (item->>'position')::integer, (item->>'checked')::boolean);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.update_planned_shopping(date, date, date, text, text, jsonb) from public;
grant execute on function public.update_planned_shopping(date, date, date, text, text, jsonb) to authenticated;

-- 家族が対象期間を切り替えた際、開いている買い物画面も読み直す。
create or replace function public.broadcast_shopping_period_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid;
  list_id uuid;
  today date := (timezone('Asia/Tokyo', now()))::date;
begin
  if row(new.shopping_day, new.shopping_period_mode, new.shopping_range_start, new.shopping_range_end)
    is not distinct from row(old.shopping_day, old.shopping_period_mode, old.shopping_range_start, old.shopping_range_end) then return null; end if;
  for list_id in select sl.id from public.shopping_lists sl where sl.household_id = new.household_id
    and sl.week_start in (
      today - ((extract(dow from today)::integer - new.shopping_day + 7) % 7) + ((7 - new.shopping_day) % 7),
      today - ((extract(dow from today)::integer - old.shopping_day + 7) % 7) + ((7 - old.shopping_day) % 7)
    ) loop
    for member_id in select p.id from public.profiles p where p.household_id = new.household_id loop
      perform realtime.broadcast_changes(
        'shopping-list:' || list_id::text || ':member:' || member_id::text,
        'PERIOD_CHANGED', tg_op, tg_table_name, tg_table_schema, new, old
      );
    end loop;
  end loop;
  return null;
end;
$$;
revoke all on function public.broadcast_shopping_period_changes() from public, anon, authenticated;
create trigger broadcast_shopping_period_changes_trigger
  after update of shopping_day, shopping_period_mode, shopping_range_start, shopping_range_end on public.household_settings
  for each row execute function public.broadcast_shopping_period_changes();
