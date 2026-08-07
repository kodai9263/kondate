-- ビューから参照した場合も、呼び出したユーザーのRLSを適用する。
alter view public.v_recipe_scores set (security_invoker = true);
alter view public.v_daily_plan set (security_invoker = true);

-- 外部キー検索とcascade/delete時の全件走査を避ける。
create index if not exists family_members_household_id_idx
  on public.family_members (household_id);
create index if not exists recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients (recipe_id);
create index if not exists template_entries_recipe_id_idx
  on public.template_entries (recipe_id);
create index if not exists plan_entries_recipe_id_idx
  on public.plan_entries (recipe_id);
create index if not exists task_states_step_id_idx
  on public.task_states (step_id);
create index if not exists task_states_checked_by_idx
  on public.task_states (checked_by);
create index if not exists shopping_items_checked_by_idx
  on public.shopping_items (checked_by);
create index if not exists seasonal_swaps_from_recipe_id_idx
  on public.seasonal_swaps (from_recipe_id);
create index if not exists seasonal_swaps_to_recipe_id_idx
  on public.seasonal_swaps (to_recipe_id);
create index if not exists meal_feedback_family_member_id_idx
  on public.meal_feedback (family_member_id);

-- Data APIの自動公開に依存せず、アプリに必要な操作だけを許可する。
grant select, update on table public.households to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.family_members to authenticated;
grant select on table public.recipes to authenticated;
grant select on table public.recipe_ingredients to authenticated;
grant select on table public.recipe_steps to authenticated;
grant select on table public.menu_templates to authenticated;
grant select on table public.template_entries to authenticated;
grant select, insert, update, delete on table public.plan_entries to authenticated;
grant select on table public.task_states to authenticated;
grant select, insert, update, delete on table public.shopping_lists to authenticated;
grant select, insert, update, delete on table public.shopping_items to authenticated;
grant select, update on table public.household_settings to authenticated;
grant select on table public.seasonal_swaps to authenticated;
grant select, insert, update, delete on table public.meal_feedback to authenticated;
grant select on table public.household_subscriptions to authenticated;
grant select on table public.recipe_nutrition to authenticated;
grant select on table public.v_recipe_scores to authenticated;
grant select on table public.v_daily_plan to authenticated;

-- SECURITY DEFINER関数はpublic実行を禁止し、用途別のロールだけに開放する。
revoke all on function public.current_household_id() from public;
revoke all on function public.toggle_task(uuid, uuid) from public;
revoke all on function public.household_has_active_subscription(uuid) from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.prevent_profile_household_change() from public;

grant execute on function public.current_household_id() to authenticated;
grant execute on function public.toggle_task(uuid, uuid) to authenticated;
grant execute on function public.household_has_active_subscription(uuid) to service_role;
