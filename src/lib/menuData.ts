import { officialNutritionRecipes } from "./nutrition/catalog";
import breakfasts from "./breakfast/templates.json";
import type { MenuData, WeekdayJa } from "@/types/domain";

// デモ・未保存時の見本も、公開対象として確認したカタログから作る。
// 旧menu-data.jsonは原本の保存用であり、画面へ読み込まない。
const weekdays: WeekdayJa[] = ["日", "月", "火", "水", "木", "金", "土"];
export const menuData: MenuData = {
  meta: { name: "献立の見本", servings: "4人分", weekStart: "日曜", policy: ["時間は目安です"], seasoningNote: "調味料の分量は各料理の材料欄を確認してください。", season: "通年", seasonalSwaps: [] },
  breakfasts: Object.fromEntries(breakfasts.map((item) => [item.sourceKey, item])),
  breakfastRotation: breakfasts.map((item) => item.sourceKey),
  weeks: Array.from({ length: 4 }, (_, week) => ({
    label: `第${week + 1}週`,
    days: weekdays.map((dow, day) => {
      const recipe = officialNutritionRecipes[(week * 7 + day) % officialNutritionRecipes.length];
      return { dow, dinner: recipe.name, side: recipe.side, fish: recipe.proteinSource === "fish", kids: false,
        prepMin: 0, cookMin: recipe.cookMinutes, totalMin: recipe.totalMinutes, servingsBase: recipe.servingsBase,
        ingredientsScalable: true, recipeNotes: recipe.recipeNotes, morning: [],
        evening: recipe.eveningSteps ?? [], seasonings: recipe.ingredientsText?.split("\n") ?? [] };
    }),
    shopping: { 肉: ["豚肉", "鶏肉"], 魚: ["鮭"], "野菜・果物": ["玉ねぎ", "小松菜"] },
  })),
};
