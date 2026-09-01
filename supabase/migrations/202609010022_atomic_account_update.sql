create or replace function public.update_current_household_account(
  display_name_input text,
  household_name_input text,
  adult_count_input integer,
  child_count_input integer,
  shopping_day_input integer,
  allergies_input text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  target_household_id uuid;
  normalized_allergies text[] := coalesce(allergies_input, '{}'::text[]);
begin
  if target_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  if char_length(trim(display_name_input)) not between 1 and 40
    or char_length(trim(household_name_input)) not between 1 and 60
    or adult_count_input not between 1 and 10
    or child_count_input not between 0 and 10
    or shopping_day_input not between 0 and 6
    or cardinality(normalized_allergies) > 30
    or exists (
      select 1
      from unnest(normalized_allergies) as allergy
      where allergy is null or char_length(trim(allergy)) not between 1 and 40
    )
  then
    raise exception using errcode = '22023', message = 'invalid account settings';
  end if;

  select profile.household_id
  into target_household_id
  from public.profiles as profile
  where profile.id = target_user_id;

  if target_household_id is null then
    raise exception using errcode = 'P0002', message = 'profile not found';
  end if;

  update public.profiles
  set display_name = trim(display_name_input)
  where id = target_user_id;

  update public.households
  set name = trim(household_name_input)
  where id = target_household_id;

  insert into public.household_settings (
    household_id,
    default_servings,
    adult_count,
    child_count,
    shopping_day,
    allergies
  )
  values (
    target_household_id,
    ceil(adult_count_input + child_count_input * 0.6)::integer,
    adult_count_input,
    child_count_input,
    shopping_day_input,
    normalized_allergies
  )
  on conflict (household_id) do update set
    default_servings = excluded.default_servings,
    adult_count = excluded.adult_count,
    child_count = excluded.child_count,
    shopping_day = excluded.shopping_day,
    allergies = excluded.allergies;
end;
$$;

revoke all on function public.update_current_household_account(text, text, integer, integer, integer, text[]) from public;
grant execute on function public.update_current_household_account(text, text, integer, integer, integer, text[]) to authenticated;

comment on function public.update_current_household_account(text, text, integer, integer, integer, text[])
  is '表示名、家族名、人数、買い物曜日、アレルギーを認証ユーザーの家族へ一括保存する';
