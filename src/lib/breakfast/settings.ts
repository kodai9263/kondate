import { z } from "zod";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { toDateKey } from "@/lib/dates";
import templates from "./templates.json";

export const breakfastTemplates = templates;
export const breakfastCategory = "朝ごはん";
const line = (max: number) => z.string().trim().min(1).max(max);
export const breakfastItemSchema = z.object({
  id: z.string().uuid(),
  sourceKey: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]).nullable(),
  name: line(80),
  shoppingItems: z.array(line(80)).max(20),
  tasks: z.array(line(200)).max(20),
  minutes: z.number().int().min(1).max(120).nullable(),
}).strict();
export const breakfastSettingsSchema = z.object({
  enabled: z.boolean(),
  items: z.array(breakfastItemSchema).max(10),
}).strict().refine((value) => !value.enabled || value.items.length > 0, "朝食を追加するか、朝食の提案をオフにしてください。")
  .refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length, "朝食が重複しています。");
export type BreakfastItem = z.infer<typeof breakfastItemSchema>;
export type BreakfastSettings = z.infer<typeof breakfastSettingsSchema>;
export type BreakfastVersion = BreakfastSettings & {
  revision: string;
  effective_date: string;
  rotation_start: string;
  legacy_rotation: boolean;
};

export function breakfastForDate(versions: BreakfastVersion[], date: string): BreakfastItem | null {
  const version = [...versions].sort((a, b) => b.effective_date.localeCompare(a.effective_date)).find((item) => item.effective_date <= date);
  if (!version?.enabled || !version.items.length) return null;
  const elapsed = differenceInCalendarDays(parseISO(date), parseISO(version.rotation_start));
  const day = version.legacy_rotation ? ((elapsed % 28) + 28) % 28 : elapsed;
  return version.items[((day % version.items.length) + version.items.length) % version.items.length];
}

export function breakfastShoppingForWeek(versions: BreakfastVersion[], weekStart: string): string[] {
  const items = new Set<string>();
  for (let day = 0; day < 7; day++) {
    const breakfast = breakfastForDate(versions, toDateKey(addDays(parseISO(weekStart), day)));
    for (const name of breakfast?.shoppingItems ?? []) items.add(name.normalize("NFKC").trim());
  }
  return [...items];
}

export function splitBreakfastLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}
