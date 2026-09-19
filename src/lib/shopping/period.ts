import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { toDateKey, toTokyoCalendarDate, weekdaysJa } from "@/lib/dates";
import { normalizeShoppingDay } from "@/lib/family/servings";

export type ShoppingPeriodMode = "today" | "week" | "custom";
export type ShoppingPeriodSelection = { mode: ShoppingPeriodMode; start?: string | null; end?: string | null };
export const maxShoppingDays = 366;

export function isShoppingRange(start: string, end: string) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= "0001-01-01" && isValid(parseISO(date));
  return validDate(start) && validDate(end) && end >= start
    && differenceInCalendarDays(parseISO(end), parseISO(start)) < maxShoppingDays;
}

export function getShoppingPeriod(shoppingDay: number, now = new Date(), selection?: ShoppingPeriodSelection) {
  const today = toTokyoCalendarDate(now);
  const day = normalizeShoppingDay(shoppingDay);
  const cycle = addDays(today, -(today.getDay() - day + 7) % 7);
  const cycleStart = toDateKey(cycle);
  const todayKey = toDateKey(today);
  const mode = selection?.mode ?? "week";
  if (mode === "custom" && !isShoppingRange(selection?.start ?? "", selection?.end ?? "")) {
    throw new Error("invalid_shopping_range");
  }
  const start = mode === "custom" ? selection!.start! : mode === "today" ? todayKey : cycleStart;
  const end = mode === "custom" ? selection!.end! : mode === "today" ? todayKey : toDateKey(addDays(cycle, 6));
  return {
    mode,
    cycleStart,
    start,
    end,
    nextCycleStart: toDateKey(addDays(cycle, 7)),
    today: todayKey,
    // 既存の手動追加を残すため、保存先は従来の日曜基準を維持する。
    storageWeekStart: toDateKey(addDays(cycle, (7 - day) % 7)),
  };
}

export type ShoppingPeriod = ReturnType<typeof getShoppingPeriod>;

export function shoppingDates(start: string, end = toDateKey(addDays(parseISO(start), 6))) {
  if (!isShoppingRange(start, end)) throw new Error("invalid_shopping_range");
  const length = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return Array.from({ length }, (_, day) => toDateKey(addDays(parseISO(start), day)));
}

export function formatShoppingDate(date: string) {
  const parsed = parseISO(date);
  return `${format(parsed, "M/d")}（${weekdaysJa[parsed.getDay()]}）`;
}

export function formatShoppingPeriod(start: string, end: string) {
  if (start === end) return formatShoppingDate(start);
  if (start.slice(0, 4) !== end.slice(0, 4)) return `${start.slice(0, 4)}/${formatShoppingDate(start)}〜${end.slice(0, 4)}/${formatShoppingDate(end)}`;
  return `${formatShoppingDate(start)}〜${formatShoppingDate(end)}`;
}
