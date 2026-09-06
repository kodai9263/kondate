alter table public.shopping_items
  add column if not exists dismissed boolean not null default false;

create or replace function public.dismiss_seasoning_shopping_item(
  target_week_start date,
  target_name text,
  target_position integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_household_id uuid := public.current_household_id();
  target_list_id uuid;
begin
  target_name := trim(target_name);
  if target_household_id is null then
    raise exception 'household_not_found';
  end if;

  if length(target_name) not between 1 and 200
    or target_position not between 0 and 500 then
    raise exception 'invalid_shopping_item';
  end if;

  insert into public.shopping_lists (household_id, week_start, generated_at)
  values (target_household_id, target_week_start, now())
  on conflict (household_id, week_start)
  do update set generated_at = coalesce(public.shopping_lists.generated_at, excluded.generated_at)
  returning id into target_list_id;

  insert into public.shopping_items (
    list_id, name, category, source, checked, dismissed, checked_by, position
  )
  values (
    target_list_id,
    target_name,
    '調味料(在庫確認)',
    'auto',
    false,
    true,
    null,
    target_position
  )
  on conflict (list_id, category, name) where source = 'auto'
  do update set
    checked = false,
    dismissed = true,
    checked_by = null,
    position = excluded.position;

  return true;
end;
$$;

revoke all on function public.dismiss_seasoning_shopping_item(date, text, integer) from public;
grant execute on function public.dismiss_seasoning_shopping_item(date, text, integer) to authenticated;

comment on function public.dismiss_seasoning_shopping_item(date, text, integer)
  is '家族の週次買い物リストから在庫のある調味料を非表示にする';
