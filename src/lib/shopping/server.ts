import { createHash } from "node:crypto";
import { cache } from "react";
import { getBreakfastVersions } from "@/lib/breakfast/server";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { getRecipeServings } from "@/lib/family/servings";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";
import { resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { getSupabaseServer } from "@/lib/supabase/server";
import { buildShoppingItemKey } from "@/lib/services/shoppingService";
import { buildPlannedShopping } from "./build";
import { getShoppingPeriod, shoppingDates } from "./period";

export const getShoppingContext = cache(async () => {
  const now = new Date();
  const supabase = await getSupabaseServer();
  const preferences = await getCurrentHouseholdPreferences(true);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("shopping_auth_required");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("household_id").eq("id", user.id).single();
  if (profileError || !profile?.household_id) throw new Error("shopping_household_unavailable");
  const { data: settings, error: settingsError } = await supabase.from("household_settings")
    .select("shopping_day,shopping_period_mode,shopping_range_start,shopping_range_end").eq("household_id", profile.household_id).single();
  if (settingsError || !settings) throw new Error("shopping_period_unavailable");
  const period = getShoppingPeriod(settings.shopping_day, now, {
    mode: settings.shopping_period_mode, start: settings.shopping_range_start, end: settings.shopping_range_end,
  });
  const { data: list, error: listError } = await supabase.from("shopping_lists")
    .select("id").eq("household_id", profile.household_id).eq("week_start", period.storageWeekStart).maybeSingle();
  if (listError) throw new Error("shopping_list_unavailable");
  return { supabase, preferences, householdId: profile.household_id as string, period, listId: list?.id as string | undefined };
});

export const getPlannedShopping = cache(async () => {
  const context = await getShoppingContext();
  const { period, preferences } = context;
  const months = [...new Set(shoppingDates(period.start, period.end).map((date) => date.slice(0, 7)))];
  const [monthly, breakfast] = await Promise.all([
    Promise.all(months.map(async (key) => {
      const [year, month] = key.split("-").map(Number);
      const planner = await getHouseholdPlannerContext(year, month, true);
      return resolveMonthlyDinnerPlan(year, month, planner);
    })),
    getBreakfastVersions(),
  ]);
  if (breakfast.error) throw new Error("shopping_breakfast_unavailable");
  const result = buildPlannedShopping({ start: period.start, end: period.end, dinners: monthly.flat(),
    breakfastVersions: breakfast.versions, servings: getRecipeServings(preferences) });
  const groups = result.groups.map((group) => ({ ...group, items: group.items.map((item) => ({
    ...item,
    // 表示名と保存キーを分離し、長文や分量変更でも古いチェックを誤適用しない。
    name: `planned-v1:${createHash("sha256").update(item.label).digest("hex")}`,
  })) }));
  return { ...context, ...result, groups };
});

export async function getSavedShoppingState(context: Awaited<ReturnType<typeof getShoppingContext>>) {
  const empty = { checkedKeys: [] as string[], dismissedKeys: [] as string[], manualItems: [] as Array<{
    id: string; category: string; name: string; position: number; checked: boolean; source: "manual";
  }> };
  if (!context.listId) return empty;
  const { data: items, error } = await context.supabase.from("shopping_items")
    .select("id,category,name,position,checked,dismissed,source").eq("list_id", context.listId).order("position");
  if (error) throw new Error("shopping_items_unavailable");
  return {
    checkedKeys: (items ?? []).filter((item) => item.checked).map((item) => buildShoppingItemKey(item.category, item.name)),
    dismissedKeys: (items ?? []).filter((item) => item.dismissed).map((item) => buildShoppingItemKey(item.category, item.name)),
    manualItems: (items ?? []).filter((item) => item.source === "manual").map((item) => ({ ...item, source: "manual" as const })),
  };
}
