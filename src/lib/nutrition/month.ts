import type { PlannedDinner } from "@/types/nutrition";

export type SavedDinnerEntry = {
  date: string;
  recipeId: string;
  locked: boolean;
};

export function parsePlannerMonth(value: string | undefined, fallback: Date) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
  }
  return { year, month };
}

export function getMonthDateRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    firstDate: formatDate(year, month, 1),
    lastDate: formatDate(year, month, lastDay),
    days: lastDay,
  };
}

export function isCompleteMonthPlan(year: number, month: number, entries: SavedDinnerEntry[]) {
  const { firstDate, lastDate, days } = getMonthDateRange(year, month);
  const dates = new Set(entries.map((entry) => entry.date));
  return entries.length === days && dates.size === days && entries.every((entry) => entry.date >= firstDate && entry.date <= lastDate);
}

export function toSavedDinnerEntries(plan: PlannedDinner[]): SavedDinnerEntry[] {
  return plan.map((day) => ({ date: day.date, recipeId: day.recipe.id, locked: day.locked }));
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
