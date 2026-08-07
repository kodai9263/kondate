export type WeekdayJa = "日" | "月" | "火" | "水" | "木" | "金" | "土";

export type Breakfast = {
  name: string;
  minutes: number;
  tasks: string[];
};

export type Dinner = {
  dow: WeekdayJa;
  dinner: string;
  side: string;
  fish: boolean;
  kids: boolean;
  prepMin: number;
  cookMin: number;
  morning: string[];
  evening: string[];
  seasonings: string[];
};

export type ShoppingByCategory = Record<string, string[]>;

export type MenuWeek = {
  label: string;
  days: Dinner[];
  shopping: ShoppingByCategory;
};

export type MenuData = {
  meta: {
    name: string;
    servings: string;
    weekStart: string;
    policy: string[];
    seasoningNote: string;
    season: string;
    seasonalSwaps: string[];
  };
  breakfasts: Record<string, Breakfast>;
  breakfastRotation: Record<WeekdayJa, string>;
  weeks: MenuWeek[];
};

export type PlanMeal = {
  date: string;
  dayIndex: number;
  dow: WeekdayJa;
  breakfast: Breakfast;
  dinner: Dinner;
};

export type Quantity = {
  name: string;
  quantity: number | null;
  unit: string | null;
};
