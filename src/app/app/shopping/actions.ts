"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { menuData } from "@/lib/menuData";
import { getShoppingCycle, seasoningShoppingCategory } from "@/lib/services/shoppingService";
import { getSupabaseServer } from "@/lib/supabase/server";

const shoppingItemSchema = z.object({
  weekIndex: z.number().int().min(0).max(3),
  weekStart: z.string().date(),
  category: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(500),
  checked: z.boolean(),
  id: z.string().uuid().optional(),
  source: z.enum(["auto", "manual"]).default("auto"),
});

const manualItemSchema = z.object({
  weekStart: z.string().date(),
  name: z.string().trim().min(1).max(200),
});

const deleteManualItemSchema = z.object({
  weekStart: z.string().date(),
  id: z.string().uuid(),
});

const dismissSeasoningSchema = z.object({
  weekIndex: z.number().int().min(0).max(3),
  weekStart: z.string().date(),
  category: z.literal(seasoningShoppingCategory),
  name: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(500),
});

export async function setShoppingItemChecked(input: unknown): Promise<{ ok: boolean }> {
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const { weekIndex, weekStart, category, name, position, checked, id, source } = parsed.data;
  const preferences = await getCurrentHouseholdPreferences();
  const currentCycle = getShoppingCycle(menuData, preferences.shoppingDay);
  if (currentCycle.weekIndex !== weekIndex || currentCycle.weekStart !== weekStart) return { ok: false };

  if (source === "auto") {
    const expectedName = menuData.weeks[weekIndex]?.shopping[category]?.[position];
    if (expectedName !== name) return { ok: false };
  } else if (!id) return { ok: false };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = source === "manual"
    ? await supabase.rpc("set_manual_shopping_item_checked", { target_item_id: id, target_checked: checked })
    : await supabase.rpc("set_shopping_item_checked", {
      target_week_start: weekStart,
      target_category: category,
      target_name: name,
      target_position: position,
      target_checked: checked,
    });
  if (error) return { ok: false };

  revalidatePath("/app/shopping");
  return { ok: true };
}

export async function addManualShoppingItem(input: unknown): Promise<{ ok: boolean; item?: { id: string; category: string; name: string; position: number; checked: boolean; source: "manual" } }> {
  const parsed = manualItemSchema.safeParse(input);
  if (!parsed.success || !await isCurrentShoppingWeek(parsed.data.weekStart)) return { ok: false };

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("add_manual_shopping_item", {
    target_week_start: parsed.data.weekStart,
    target_name: parsed.data.name,
  });
  if (error || !data) return { ok: false };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/app/shopping");
  return { ok: true, item: { id: row.id, category: row.category, name: row.name, position: row.position, checked: row.checked, source: "manual" } };
}

export async function deleteManualShoppingItem(input: unknown): Promise<{ ok: boolean }> {
  const parsed = deleteManualItemSchema.safeParse(input);
  if (!parsed.success || !await isCurrentShoppingWeek(parsed.data.weekStart)) return { ok: false };

  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc("delete_manual_shopping_item", { target_item_id: parsed.data.id });
  if (error) return { ok: false };
  revalidatePath("/app/shopping");
  return { ok: true };
}

export async function dismissSeasoningShoppingItem(input: unknown): Promise<{ ok: boolean }> {
  const parsed = dismissSeasoningSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const { weekIndex, weekStart, category, name, position } = parsed.data;
  const preferences = await getCurrentHouseholdPreferences();
  const currentCycle = getShoppingCycle(menuData, preferences.shoppingDay);
  const expectedName = menuData.weeks[weekIndex]?.shopping[category]?.[position];
  if (currentCycle.weekIndex !== weekIndex || currentCycle.weekStart !== weekStart || expectedName !== name) {
    return { ok: false };
  }

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.rpc("dismiss_seasoning_shopping_item", {
    target_week_start: weekStart,
    target_name: name,
    target_position: position,
  });
  if (error) return { ok: false };
  revalidatePath("/app/shopping");
  return { ok: true };
}

async function isCurrentShoppingWeek(weekStart: string) {
  const preferences = await getCurrentHouseholdPreferences();
  return getShoppingCycle(menuData, preferences.shoppingDay).weekStart === weekStart;
}
