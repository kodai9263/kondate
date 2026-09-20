-- チェック済みの買い物を材料の利用単位で保存し、重なる次回期間から差し引く。
create table public.shopping_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  range_start date not null,
  range_end date not null,
  period_mode text not null check (period_mode in ('today', 'week', 'custom')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  contributions jsonb not null check (jsonb_typeof(contributions) = 'array'),
  completed_by uuid not null references public.profiles(id),
  completed_at timestamptz not null default now(),
  check (range_end >= range_start and range_end - range_start < 366)
);

create index shopping_completions_household_range_idx
  on public.shopping_completions (household_id, range_start, range_end);
create index shopping_completions_list_completed_idx
  on public.shopping_completions (list_id, completed_at desc);

alter table public.shopping_completions enable row level security;

create policy "shopping completions household read"
  on public.shopping_completions for select to authenticated
  using (household_id = (select public.current_household_id()));
create policy "shopping completions household insert"
  on public.shopping_completions for insert to authenticated
  with check (
    household_id = (select public.current_household_id())
    and completed_by = (select auth.uid())
    and exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id and sl.household_id = (select public.current_household_id())
    )
  );
create policy "shopping completions household delete"
  on public.shopping_completions for delete to authenticated
  using (household_id = (select public.current_household_id()));

grant select, insert, delete on table public.shopping_completions to authenticated;

create function public.complete_planned_shopping(
  target_week_start date,
  expected_range_start date,
  expected_range_end date,
  expected_period_mode text,
  auto_items jsonb,
  manual_ids uuid[]
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
  current_list public.shopping_lists;
  auto_count integer;
  manual_count integer := coalesce(cardinality(manual_ids), 0);
  contribution_count integer;
  completion_items jsonb;
  completion_contributions jsonb;
  saved_id uuid;
begin
  if household is null then raise exception 'household_not_found'; end if;
  if jsonb_typeof(auto_items) is distinct from 'array' or manual_ids is null then
    raise exception 'invalid_shopping_completion';
  end if;
  select count(*) into auto_count from jsonb_array_elements(auto_items);
  if auto_count + manual_count not between 1 and 1000 then raise exception 'invalid_shopping_completion'; end if;
  if manual_count <> (select count(distinct value) from unnest(manual_ids) value) then
    raise exception 'invalid_shopping_completion';
  end if;

  select * into settings from public.household_settings hs where hs.household_id = household for update;
  if not found then raise exception 'shopping_settings_unavailable'; end if;
  cycle_start := today - ((extract(dow from today)::integer - settings.shopping_day + 7) % 7);
  storage_start := cycle_start + ((7 - settings.shopping_day) % 7);
  if target_week_start is distinct from storage_start then raise exception 'shopping_period_changed'; end if;
  current_start := case settings.shopping_period_mode when 'today' then today when 'custom' then settings.shopping_range_start else cycle_start end;
  current_end := case settings.shopping_period_mode when 'today' then today when 'custom' then settings.shopping_range_end else cycle_start + 6 end;
  if expected_range_start is distinct from current_start or expected_range_end is distinct from current_end
    or expected_period_mode is distinct from settings.shopping_period_mode then raise exception 'shopping_period_changed'; end if;

  select * into current_list from public.shopping_lists sl
    where sl.household_id = household and sl.week_start = storage_start for update;
  if not found then raise exception 'shopping_list_unavailable'; end if;

  if exists (
    select 1 from jsonb_array_elements(auto_items) entry
    where jsonb_typeof(entry) <> 'object'
      or entry - array['source','category','name','label','position','contributions'] <> '{}'::jsonb
      or entry->>'source' is distinct from 'auto'
      or length(coalesce(entry->>'category', '')) not between 1 and 80
      or length(coalesce(entry->>'name', '')) not between 1 and 200
      or length(coalesce(entry->>'label', '')) not between 1 and 500
      or coalesce(entry->>'position', '') !~ '^\d{1,3}$'
      or (entry->>'position')::integer not between 0 and 500
      or jsonb_typeof(entry->'contributions') is distinct from 'array'
      or jsonb_array_length(entry->'contributions') = 0
  ) then raise exception 'invalid_shopping_completion'; end if;

  if auto_count <> (
    select count(*) from public.shopping_items si
    where si.list_id = current_list.id and si.source = 'auto' and si.checked
      and exists (
        select 1 from jsonb_array_elements(auto_items) entry
        where entry->>'category' = si.category and entry->>'name' = si.name
      )
  ) then raise exception 'shopping_item_not_found'; end if;

  if manual_count <> (
    select count(*) from public.shopping_items si
    where si.list_id = current_list.id and si.source = 'manual' and si.checked and si.id = any(manual_ids)
  ) then raise exception 'shopping_item_not_found'; end if;

  select coalesce(jsonb_agg(contribution), '[]'::jsonb), count(*)
    into completion_contributions, contribution_count
  from jsonb_array_elements(auto_items) entry
  cross join lateral jsonb_array_elements(entry->'contributions') contribution;
  if contribution_count > 20000 then raise exception 'invalid_shopping_completion'; end if;
  if exists (
    select 1 from jsonb_array_elements(completion_contributions) contribution
    where jsonb_typeof(contribution) <> 'object'
      or contribution - array['key','date','meal','original','scale'] <> '{}'::jsonb
      or length(coalesce(contribution->>'key', '')) not between 1 and 1000
      or coalesce(contribution->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or (contribution->>'date')::date not between current_start and current_end
      or length(coalesce(contribution->>'meal', '')) not between 1 and 200
      or length(coalesce(contribution->>'original', '')) not between 1 and 500
      or jsonb_typeof(contribution->'scale') is distinct from 'number'
      or (contribution->>'scale')::numeric <= 0
  ) then raise exception 'invalid_shopping_completion'; end if;
  if contribution_count <> (
    select count(distinct contribution->>'key') from jsonb_array_elements(completion_contributions) contribution
  ) then raise exception 'invalid_shopping_completion'; end if;

  select auto_items || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', 'manual', 'id', si.id, 'category', si.category, 'name', si.name,
      'label', si.name, 'position', si.position, 'contributions', '[]'::jsonb
    ) order by si.position)
    from public.shopping_items si
    where si.list_id = current_list.id and si.source = 'manual' and si.id = any(manual_ids)
  ), '[]'::jsonb) into completion_items;

  insert into public.shopping_completions (
    household_id, list_id, range_start, range_end, period_mode, items, contributions, completed_by
  ) values (
    household, current_list.id, current_start, current_end, settings.shopping_period_mode,
    completion_items, completion_contributions, (select auth.uid())
  ) returning id into saved_id;

  delete from public.shopping_items si
  where si.list_id = current_list.id and (
    (si.source = 'manual' and si.id = any(manual_ids))
    or (si.source = 'auto' and exists (
      select 1 from jsonb_array_elements(auto_items) entry
      where entry->>'category' = si.category and entry->>'name' = si.name
    ))
  );

  return jsonb_build_object('ok', true, 'completion_id', saved_id, 'completed_count', auto_count + manual_count);
end;
$$;

create function public.undo_planned_shopping_completion(
  target_completion_id uuid,
  target_week_start date,
  expected_range_start date,
  expected_range_end date,
  expected_period_mode text
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
  current_list public.shopping_lists;
  completion public.shopping_completions;
  entry jsonb;
  restored_count integer;
begin
  if household is null then raise exception 'household_not_found'; end if;
  select * into settings from public.household_settings hs where hs.household_id = household for update;
  if not found then raise exception 'shopping_settings_unavailable'; end if;
  cycle_start := today - ((extract(dow from today)::integer - settings.shopping_day + 7) % 7);
  storage_start := cycle_start + ((7 - settings.shopping_day) % 7);
  if target_week_start is distinct from storage_start then raise exception 'shopping_period_changed'; end if;
  current_start := case settings.shopping_period_mode when 'today' then today when 'custom' then settings.shopping_range_start else cycle_start end;
  current_end := case settings.shopping_period_mode when 'today' then today when 'custom' then settings.shopping_range_end else cycle_start + 6 end;
  if expected_range_start is distinct from current_start or expected_range_end is distinct from current_end
    or expected_period_mode is distinct from settings.shopping_period_mode then raise exception 'shopping_period_changed'; end if;

  select * into current_list from public.shopping_lists sl
    where sl.household_id = household and sl.week_start = storage_start for update;
  if not found then raise exception 'shopping_list_unavailable'; end if;
  select * into completion from public.shopping_completions sc
    where sc.id = target_completion_id and sc.household_id = household and sc.list_id = current_list.id;
  if not found then raise exception 'shopping_completion_not_found'; end if;
  if exists (
    select 1 from public.shopping_completions newer
    where newer.list_id = current_list.id
      and (newer.completed_at, newer.id) > (completion.completed_at, completion.id)
  ) then raise exception 'shopping_completion_not_latest'; end if;

  for entry in select value from jsonb_array_elements(completion.items) loop
    if entry->>'source' = 'manual' then
      insert into public.shopping_items (id, list_id, name, category, source, checked, checked_by, dismissed, position)
      values ((entry->>'id')::uuid, current_list.id, entry->>'name', '追加したもの', 'manual', true, (select auth.uid()), false, (entry->>'position')::integer)
      on conflict (list_id, name) where source = 'manual'
      do update set checked = true, checked_by = excluded.checked_by, dismissed = false;
    else
      insert into public.shopping_items (list_id, name, category, source, checked, checked_by, dismissed, position)
      values (current_list.id, entry->>'name', entry->>'category', 'auto', true, (select auth.uid()), false, (entry->>'position')::integer)
      on conflict (list_id, category, name) where source = 'auto'
      do update set checked = true, checked_by = excluded.checked_by, dismissed = false, position = excluded.position;
    end if;
  end loop;
  restored_count := jsonb_array_length(completion.items);
  delete from public.shopping_completions where id = completion.id;
  return jsonb_build_object('ok', true, 'restored_count', restored_count);
end;
$$;

revoke all on function public.complete_planned_shopping(date, date, date, text, jsonb, uuid[]) from public;
revoke all on function public.undo_planned_shopping_completion(uuid, date, date, date, text) from public;
grant execute on function public.complete_planned_shopping(date, date, date, text, jsonb, uuid[]) to authenticated;
grant execute on function public.undo_planned_shopping_completion(uuid, date, date, date, text) to authenticated;

create function public.broadcast_shopping_completion_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_list_id uuid := coalesce(new.list_id, old.list_id);
  member_id uuid;
begin
  for member_id in
    select p.id from public.profiles p
    join public.shopping_lists sl on sl.household_id = p.household_id
    where sl.id = target_list_id
  loop
    perform realtime.broadcast_changes(
      'shopping-list:' || target_list_id::text || ':member:' || member_id::text,
      'COMPLETION_CHANGED', tg_op, tg_table_name, tg_table_schema, new, old
    );
  end loop;
  return null;
end;
$$;

revoke all on function public.broadcast_shopping_completion_changes() from public, anon, authenticated;
create trigger broadcast_shopping_completion_changes_trigger
  after insert or delete on public.shopping_completions
  for each row execute function public.broadcast_shopping_completion_changes();

comment on table public.shopping_completions is '買い物完了時の購入済み材料と手動品を、家族・対象期間ごとに保存する';
comment on function public.complete_planned_shopping(date, date, date, text, jsonb, uuid[])
  is '現在の家族・期間・チェック状態を照合して購入済み材料を保存する';
comment on function public.undo_planned_shopping_completion(uuid, date, date, date, text)
  is '現在のリストで直前の買い物完了だけを取り消す';
