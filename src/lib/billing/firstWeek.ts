import type { Route } from "next";
import { addDays, isValid, parseISO } from "date-fns";
import { toDateKey } from "@/lib/dates";

export function firstWeekDates(start: string): string[] {
  const date = parseISO(start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !isValid(date) || start < "2020-01-01" || start > "2100-12-25") throw new Error("invalid_first_week");
  return Array.from({ length: 7 }, (_, offset) => toDateKey(addDays(date, offset)));
}

export function isCompleteFirstWeek(start: string, entries: Array<{ date: string }>) {
  try {
    const dates = firstWeekDates(start);
    const unique = new Set(entries.map((entry) => entry.date));
    return entries.length === 7 && unique.size === 7 && dates.every((date) => unique.has(date));
  } catch { return false; }
}

export function normalizeRecipeSelection(value: unknown) {
  if (typeof value !== "string") return null;
  return /^(official:[a-z0-9-]{1,100}|community:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(value) ? value : null;
}

export function recipeSelectionDestination(selection: string, favorite = false): Route {
  const normalized = normalizeRecipeSelection(selection);
  return normalized ? `${favorite ? "/app/favorites" : "/app/planner/setup"}?recipe=${encodeURIComponent(normalized)}` as Route : "/app";
}

// 登録後の遷移先は、この導線で使用する内部画面だけを許可する。
export function normalizeMenuNext(value: unknown): Route {
  if (typeof value !== "string") return "/app";
  const match = /^\/app\/(planner\/setup|favorites)\?recipe=([^&]+)$/.exec(value);
  if (!match) return "/app";
  try {
    const selection = normalizeRecipeSelection(decodeURIComponent(match[2]));
    return selection ? recipeSelectionDestination(selection, match[1] === "favorites") : "/app";
  } catch { return "/app"; }
}
