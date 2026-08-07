"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { menuData } from "@/lib/menuData";
import { getShoppingCycle } from "@/lib/services/shoppingService";
import { getSupabaseServer } from "@/lib/supabase/server";

const shoppingItemSchema = z.object({
  weekIndex: z.number().int().min(0).max(3),
  weekStart: z.string().date(),
  category: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(500),
  checked: z.boolean(),
});

export async function setShoppingItemChecked(input: unknown): Promise<{ ok: boolean }> {
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const { weekIndex, weekStart, category, name, position, checked } = parsed.data;
  const preferences = await getCurrentHouseholdPreferences();
  const currentCycle = getShoppingCycle(menuData, preferences.shoppingDay);
  if (currentCycle.weekIndex !== weekIndex || currentCycle.weekStart !== weekStart) return { ok: false };

  const expectedName = menuData.weeks[weekIndex]?.shopping[category]?.[position];
  if (expectedName !== name) return { ok: false };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.rpc("set_shopping_item_checked", {
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
