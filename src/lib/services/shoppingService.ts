import type { MenuData, ShoppingByCategory } from "@/types/domain";
import { addDays, startOfDay } from "date-fns";
import { toDateKey, toTokyoCalendarDate } from "@/lib/dates";
import { findTodayPlan } from "@/lib/services/planService";

export const shoppingCategoryOrder = [
  "肉",
  "魚",
  "野菜・果物",
  "豆腐・卵・乳",
  "麺・パン",
  "冷凍・缶詰",
  "朝ごはん定番",
  "調味料(在庫確認)",
];

export const seasoningShoppingCategory = "調味料(在庫確認)";

export type ShoppingItemDraft = {
  category: string;
  name: string;
  source: "auto" | "manual";
  checked: boolean;
  position: number;
};

export function getStaticShoppingForTemplateWeek(menu: MenuData, weekIndex: number): ShoppingByCategory {
  const week = menu.weeks[weekIndex];
  if (!week) throw new Error(`weekIndex out of range: ${weekIndex}`);
  return week.shopping;
}

export function buildShoppingItemsFromStaticList(
  shopping: ShoppingByCategory,
  manualItems: ShoppingItemDraft[] = [],
): ShoppingItemDraft[] {
  const autoItems = orderShoppingEntries(shopping).flatMap(([category, items]) =>
    items.map((name, index) => ({
      category,
      name,
      source: "auto" as const,
      checked: false,
      position: index,
    })),
  );

  return [...autoItems, ...manualItems.filter((item) => item.source === "manual")];
}

export function orderShoppingEntries(shopping: ShoppingByCategory): Array<[string, string[]]> {
  return Object.entries(shopping).sort(([a], [b]) => {
    const ai = shoppingCategoryOrder.indexOf(a);
    const bi = shoppingCategoryOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, "ja");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export function getCurrentShoppingWeekIndex(menu: MenuData, today = new Date()): number {
  return Math.floor(findTodayPlan(menu, today).dayIndex / 7);
}

export function getShoppingCycle(menu: MenuData, shoppingDay: number, today = new Date()): { weekIndex: number; weekStart: string } {
  const normalizedShoppingDay = Math.min(Math.max(Math.trunc(shoppingDay), 0), 6);
  const tokyoCalendarDate = toTokyoCalendarDate(today);
  const daysSinceShoppingDay = (tokyoCalendarDate.getDay() - normalizedShoppingDay + 7) % 7;
  const latestShoppingDay = addDays(startOfDay(tokyoCalendarDate), -daysSinceShoppingDay);
  const daysUntilSunday = (7 - normalizedShoppingDay) % 7;
  const targetWeekStart = addDays(latestShoppingDay, daysUntilSunday);

  return {
    weekIndex: getCurrentShoppingWeekIndex(menu, targetWeekStart),
    weekStart: toDateKey(targetWeekStart),
  };
}

export function buildShoppingItemKey(category: string, name: string): string {
  return `${category}\u001f${name}`;
}
