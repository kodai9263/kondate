-- 体験・副菜の検証を維持し、作らない日の状態を料理と一緒に保存する。
create or replace function kondate_private.save_first_week(entries jsonb, servings_input int)
returns void language plpgsql security definer set search_path = '' as $$
declare h uuid := public.current_household_id(); w public.household_first_weeks; n int; first_date date;
begin
  if auth.uid() is null or h is null or not public.can_use_breakfast_settings() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  perform 1 from public.households where id = h for update;
  select * into w from public.household_first_weeks where household_id = h;
  if not found then raise exception 'setup_required'; end if;
  if not coalesce(kondate_private.has_planning_access(h),false) then raise exception 'paid_plan_required'; end if;
  if servings_input is null or servings_input not between 1 and 20 or jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) <> 7 then raise exception 'invalid_first_week'; end if;
  select min(e.date) into first_date from jsonb_to_recordset(entries) as e(date date);
  select count(distinct e.date) into n from jsonb_to_recordset(entries) as e(date date, "recipeId" uuid, locked boolean, "sideMode" text, "sideDishId" uuid)
    join public.recipes r on r.id = e."recipeId" and (r.household_id is null or r.household_id = h) and r.archived_at is null and r.category <> 'breakfast'
    where e.date between first_date and first_date + 6 and e.locked is not null
      and coalesce(e."sideMode",'default') in ('default','none','custom')
      and ((coalesce(e."sideMode",'default') = 'custom' and exists(select 1 from public.side_dishes sd where sd.id = e."sideDishId" and sd.household_id = h and sd.archived_at is null))
        or (coalesce(e."sideMode",'default') <> 'custom' and e."sideDishId" is null));
  if n <> 7 then raise exception 'invalid_first_week'; end if;
  update public.household_first_weeks set start_date = selected_start where household_id = h and start_date is null;
  insert into public.plan_entries(household_id,date,meal_type,recipe_id,servings,status,locked,side_mode,side_dish_id)
    select h,e.date,'dinner',e."recipeId",servings_input,case when coalesce(e.skipped,false) then 'skipped' else 'planned' end,e.locked,coalesce(e."sideMode",'default'),e."sideDishId" from jsonb_to_recordset(entries) as e(date date,"recipeId" uuid,locked boolean,"sideMode" text,"sideDishId" uuid,skipped boolean)
    on conflict (household_id,date,meal_type) do update set recipe_id = excluded.recipe_id,servings = excluded.servings,locked = excluded.locked,side_mode = excluded.side_mode,side_dish_id = excluded.side_dish_id,status = excluded.status;
end;
$$;
