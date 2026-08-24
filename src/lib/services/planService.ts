import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { toDateKey, toTokyoCalendarDate, weekdayJa } from "@/lib/dates";
import type { MenuData, PlanMeal } from "@/types/domain";

export function buildRotationPlan(menu: MenuData, startDateKey: string): PlanMeal[] {
  const start = parseISO(startDateKey);

  return menu.weeks.flatMap((week, weekIndex) =>
    week.days.map((dinner, dayOfWeek) => {
      const date = addDays(start, weekIndex * 7 + dayOfWeek);
      const dow = weekdayJa(date);
      const breakfastKey = menu.breakfastRotation[dow];
      const breakfast = menu.breakfasts[breakfastKey];

      if (!breakfast) {
        throw new Error(`Breakfast rotation is missing for ${dow}`);
      }

      return {
        date: toDateKey(date),
        dayIndex: weekIndex * 7 + dayOfWeek,
        dow,
        breakfast,
        dinner,
      };
    }),
  );
}

export function findTodayPlan(menu: MenuData, today = new Date()): PlanMeal {
  const rotationStartKey = "2026-07-26";
  const plan = buildRotationPlan(menu, rotationStartKey);
  const calendarDate = toTokyoCalendarDate(today);
  const elapsedDays = differenceInCalendarDays(calendarDate, parseISO(rotationStartKey));
  const offset = ((elapsedDays % plan.length) + plan.length) % plan.length;
  return {
    ...plan[offset],
    date: toDateKey(calendarDate),
    dow: weekdayJa(calendarDate),
  };
}
