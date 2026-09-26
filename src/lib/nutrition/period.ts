import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { toDateKey, toTokyoCalendarDate } from "@/lib/dates";
import { defaultShoppingDay, normalizeShoppingDay } from "@/lib/family/servings";
import { parsePlannerMonth } from "@/lib/nutrition/month";

export type PlannerView = "week" | "month";
export type PlannerSearchParams = { view?: string; date?: string; month?: string };

export function parsePlannerPeriod(params: PlannerSearchParams, now = new Date()) {
  const today = toDateKey(toTokyoCalendarDate(now));
  const view: PlannerView = params.view === "month" || (!params.view && params.month) ? "month" : "week";
  const parsed = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? parseISO(params.date) : null;
  const validDate = parsed && !Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2100;
  const { year, month } = parsePlannerMonth(params.month, parseISO(today));
  const date = validDate ? params.date! : params.month ? `${year}-${String(month).padStart(2, "0")}-01` : today;
  return { view, date, today };
}

export function plannerDates(view: PlannerView, date: string, shoppingDay = defaultShoppingDay) {
  const anchor = parseISO(date);
  const start = view === "week" ? addDays(anchor, -((anchor.getDay() - normalizeShoppingDay(shoppingDay) + 7) % 7)) : startOfMonth(anchor);
  const end = view === "week" ? addDays(start, 6) : endOfMonth(anchor);
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export function plannerMonths(view: PlannerView, date: string, shoppingDay = defaultShoppingDay) {
  return [...new Set(plannerDates(view, date, shoppingDay).map((day) => day.slice(0, 7)))].map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { year, month, key };
  });
}

export function movePlannerDate(view: PlannerView, date: string, offset: number) {
  return toDateKey(view === "week" ? addDays(parseISO(date), offset * 7) : addMonths(startOfMonth(parseISO(date)), offset));
}

export function plannerHref(view: PlannerView, date: string, demo = false) {
  return `${demo ? "/demo" : "/app"}/planner?view=${view}&date=${date}` as const;
}

export function plannerLabel(view: PlannerView, date: string, shoppingDay = defaultShoppingDay) {
  if (view === "month") return format(parseISO(date), "yyyy年 M月");
  const days = plannerDates(view, date, shoppingDay);
  const start = parseISO(days[0]);
  const end = parseISO(days[6]);
  return `${format(start, "yyyy年 M/d")}〜${format(end, start.getFullYear() === end.getFullYear() ? "M/d" : "yyyy年 M/d")}`;
}

export function monthCalendarDates(date: string) {
  const days = plannerDates("month", date);
  const leading = (parseISO(days[0]).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return cells;
}
