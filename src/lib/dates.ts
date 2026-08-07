import { addDays, format, startOfDay } from "date-fns";
import type { WeekdayJa } from "@/types/domain";

export const weekdaysJa: WeekdayJa[] = ["日", "月", "火", "水", "木", "金", "土"];

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function startOfSundayWeek(date: Date): Date {
  const base = startOfDay(date);
  return addDays(base, -base.getDay());
}

export function weekdayJa(date: Date): WeekdayJa {
  return weekdaysJa[date.getDay()];
}

export function getSeason(date: Date): "spring" | "summer" | "autumn" | "winter" {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}
