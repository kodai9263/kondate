create unique index if not exists shopping_items_auto_identity_uidx
  on public.shopping_items (list_id, category, name)
  where source = 'auto';

create or replace function public.set_shopping_item_checked(
  target_week_start date,
  target_category text,
  target_name text,
  target_position integer,
  target_checked boolean
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  target_household_id uuid := public.current_household_id();
  target_list_id uuid;
begin
  if target_household_id is null then
    raise exception 'household_not_found';
  end if;

  if length(target_category) not between 1 and 80
    or length(target_name) not between 1 and 200
    or target_position not between 0 and 500 then
    raise exception 'invalid_shopping_item';
  end if;

  insert into public.shopping_lists (household_id, week_start, generated_at)
  values (target_household_id, target_week_start, now())
  on conflict (household_id, week_start)
  do update set generated_at = coalesce(public.shopping_lists.generated_at, excluded.generated_at)
  returning id into target_list_id;

  insert into public.shopping_items (list_id, name, category, source, checked, checked_by, position)
  values (
    target_list_id,
    target_name,
    target_category,
    'auto',
    target_checked,
    case when target_checked then (select auth.uid()) else null end,
    target_position
  )
  on conflict (list_id, category, name) where source = 'auto'
  do update set
    checked = excluded.checked,
    checked_by = excluded.checked_by,
    position = excluded.position;

  return target_checked;
end;
$$;

revoke all on function public.set_shopping_item_checked(date, text, text, integer, boolean) from public;
grant execute on function public.set_shopping_item_checked(date, text, text, integer, boolean) to authenticated;

comment on function public.set_shopping_item_checked(date, text, text, integer, boolean)
  is '家族で共有する週次買い物リストのチェック状態を原子的に保存する';
