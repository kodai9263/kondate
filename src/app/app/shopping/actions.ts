"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { seasoningShoppingCategory } from "@/lib/services/shoppingService";
import { getPlannedShopping, getShoppingContext } from "@/lib/shopping/server";
import { isShoppingRange } from "@/lib/shopping/period";

const periodMode = z.enum(["today", "week", "custom"]);
const periodFields = { weekStart: z.string().date(), rangeStart: z.string().date(), rangeEnd: z.string().date(), periodMode };
const periodSchema = z.object(periodFields);
const shoppingItemSchema = z.object({
  ...periodFields, category: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(500), checked: z.boolean(),
  id: z.string().uuid().optional(), source: z.enum(["auto", "manual"]).default("auto"),
});
const manualItemSchema = z.object({ ...periodFields, name: z.string().trim().min(1).max(200) });
const deleteManualItemSchema = z.object({ ...periodFields, id: z.string().uuid() });
const dismissSeasoningSchema = z.object({ ...periodFields, category: z.literal(seasoningShoppingCategory),
  name: z.string().trim().min(1).max(200), position: z.number().int().min(0).max(500) });

type Result = { ok: boolean; item?: { id: string; category: string; name: string; position: number; checked: boolean; source: "manual" } };
type PeriodInput = z.infer<typeof periodSchema>;

async function mutate(input: PeriodInput, operation: string, item: Record<string, unknown> = {}, checkAuto = false): Promise<Result> {
  try {
    const context = await getShoppingContext();
    if (input.weekStart !== context.period.storageWeekStart || input.rangeStart !== context.period.start
      || input.rangeEnd !== context.period.end || input.periodMode !== context.period.mode) return { ok: false };
    if (checkAuto) {
      const shopping = await getPlannedShopping();
      const expected = shopping.groups.find((group) => group.category === item.category)?.items[Number(item.position)];
      if (!expected || expected.name !== item.name) return { ok: false };
    }
    // DBでも期間と所有権を行ロックの下で確認し、別端末の期間変更との競合を防ぐ。
    const { data, error } = await context.supabase.rpc("update_planned_shopping", {
      target_week_start: input.weekStart, expected_range_start: input.rangeStart, expected_range_end: input.rangeEnd,
      expected_period_mode: input.periodMode, operation, item,
    });
    if (error || data?.ok !== true) return { ok: false };
    revalidatePath("/app/shopping");
    revalidatePath("/app");
    return data as Result;
  } catch { return { ok: false }; }
}

export async function setShoppingItemChecked(input: unknown): Promise<Result> {
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success || (parsed.data.source === "manual" && !parsed.data.id)) return { ok: false };
  return mutate(parsed.data, "check", parsed.data, parsed.data.source === "auto");
}
export async function addManualShoppingItem(input: unknown): Promise<Result> {
  const parsed = manualItemSchema.safeParse(input);
  return parsed.success ? mutate(parsed.data, "add", parsed.data) : { ok: false };
}
export async function deleteManualShoppingItem(input: unknown): Promise<Result> {
  const parsed = deleteManualItemSchema.safeParse(input);
  return parsed.success ? mutate(parsed.data, "delete", parsed.data) : { ok: false };
}
export async function dismissSeasoningShoppingItem(input: unknown): Promise<Result> {
  const parsed = dismissSeasoningSchema.safeParse(input);
  return parsed.success ? mutate(parsed.data, "dismiss", parsed.data, true) : { ok: false };
}
export async function changeShoppingPeriod(input: unknown): Promise<Result> {
  const parsed = periodSchema.extend({ mode: periodMode, start: z.string().date().optional(), end: z.string().date().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { mode, start, end } = parsed.data;
  if (mode === "custom" && !isShoppingRange(start ?? "", end ?? "")) return { ok: false };
  return mutate(parsed.data, "period", { mode, start, end });
}
export async function restoreShoppingSeasonings(input: unknown): Promise<Result> {
  const parsed = periodSchema.safeParse(input);
  return parsed.success ? mutate(parsed.data, "restore") : { ok: false };
}
