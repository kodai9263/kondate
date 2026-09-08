import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { defaultBreakfastChoices, normalizeBreakfastChoices, type BreakfastKey } from "@/lib/breakfast/preferences";
import { toDateKey, toTokyoCalendarDate, weekdayJa } from "@/lib/dates";
import type { MenuData, PlanMeal } from "@/types/domain";

export function buildRotationPlan(
  menu: MenuData,
  startDateKey: string,
  breakfastChoices: BreakfastKey[] = defaultBreakfastChoices,
): PlanMeal[] {
  const start = parseISO(startDateKey);
  const selectedBreakfasts = normalizeBreakfastChoices(breakfastChoices);

  return menu.weeks.flatMap((week, weekIndex) =>
    week.days.map((dinner, dayOfWeek) => {
      const date = addDays(start, weekIndex * 7 + dayOfWeek);
      const dow = weekdayJa(date);
      const dayIndex = weekIndex * 7 + dayOfWeek;
      const breakfastKey = selectedBreakfasts.length > 0
        ? selectedBreakfasts[dayIndex % selectedBreakfasts.length]
        : null;
      const breakfast = breakfastKey ? menu.breakfasts[breakfastKey] : null;

      if (breakfastKey && !breakfast) {
        throw new Error(`Breakfast is missing for ${breakfastKey}`);
      }

      return {
        date: toDateKey(date),
        dayIndex,
        dow,
        breakfast,
        dinner,
      };
    }),
  );
}

export function findTodayPlan(
  menu: MenuData,
  today = new Date(),
  breakfastChoices: BreakfastKey[] = defaultBreakfastChoices,
): PlanMeal {
  const rotationStartKey = "2026-07-26";
  const plan = buildRotationPlan(menu, rotationStartKey, breakfastChoices);
  const calendarDate = toTokyoCalendarDate(today);
  const elapsedDays = differenceInCalendarDays(calendarDate, parseISO(rotationStartKey));
  const offset = ((elapsedDays % plan.length) + plan.length) % plan.length;
  return {
    ...plan[offset],
    date: toDateKey(calendarDate),
    dow: weekdayJa(calendarDate),
  };
}
