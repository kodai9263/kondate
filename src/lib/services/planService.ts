import { addDays, parseISO } from "date-fns";
import { toDateKey, weekdayJa } from "@/lib/dates";
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
  const plan = buildRotationPlan(menu, "2026-07-26");
  const offset = Math.abs(Math.floor(today.getTime() / 86400000)) % plan.length;
  return plan[offset];
}
