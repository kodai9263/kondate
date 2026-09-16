import type { MenuData, ShoppingByCategory } from "@/types/domain";
import { breakfastCategory, breakfastShoppingForWeek, type BreakfastVersion } from "./settings";

// 4週分の夕食の材料・副菜・工程を照合した置換。朝食と混在した固定量を残さない。
const dinnerReplacements: Array<Record<string, string | null>> = [
  { "卵 1パック": "卵 1個", "牛乳 2本": "牛乳 大さじ2", "ミニトマト 2パック": "ミニトマト（夕食用）" },
  { "卵 2パック": "卵（親子丼用）", "牛乳 2本": null, "ミニトマト 2パック": "ミニトマト（夕食用）" },
  { "卵 1パック": "卵 4個", "牛乳 2本": null, "ミニトマト 2パック": null },
  { "卵 2パック": "卵 2個", "牛乳 2本": null, "ミニトマト 2パック": "ミニトマト（夕食用）" },
];

export function shoppingWithBreakfast(menu: MenuData, weekIndex: number, weekStart: string, versions: BreakfastVersion[]): ShoppingByCategory {
  const shopping: ShoppingByCategory = {};
  const replacements = dinnerReplacements[weekIndex];
  for (const [category, items] of Object.entries(menu.weeks[weekIndex].shopping)) {
    if (category === "朝ごはん定番") continue;
    const remaining = items.flatMap((name) => {
      if (["バナナ 2房", "ヨーグルト 大1", "食パン 1斤"].includes(name)) return [];
      const replacement = Object.hasOwn(replacements, name) ? replacements[name] : name;
      return replacement ? [replacement] : [];
    });
    if (remaining.length) shopping[category] = remaining;
  }
  // 第4週の紅生姜は牛丼の仕上げに使うため、夕食用として残す。
  if (weekIndex === 3) shopping["冷凍・缶詰"] = [...(shopping["冷凍・缶詰"] ?? []), "紅生姜 1袋"];
  const breakfastItems = breakfastShoppingForWeek(versions, weekStart);
  if (breakfastItems.length) shopping[breakfastCategory] = breakfastItems;
  return shopping;
}
