import { breakfastForDate, type BreakfastVersion } from "@/lib/breakfast/settings";
import type { PlannedDinner } from "@/types/nutrition";
import { formatIngredientAmount, ingredientCategory, normalizedQuantity, parseIngredientLine } from "./ingredients";
import { shoppingDates } from "./period";

export type ShoppingContribution = { date: string; meal: string; original: string; scale: number };
export type PlannedShoppingItem = { category: string; name: string; label: string; position: number; needsReview: boolean; contributions: ShoppingContribution[] };
export type PlannedShoppingGroup = { category: string; items: PlannedShoppingItem[] };

const categoryOrder = ["肉", "魚", "野菜・その他", "豆腐・卵・乳", "米・麺・パン", "冷凍・缶詰・乾物", "調味料(在庫確認)", "水・氷（調理用）"];

export function buildPlannedShopping({ start, end, dinners, breakfastVersions, servings }: {
  start: string; end?: string; dinners: PlannedDinner[]; breakfastVersions: BreakfastVersion[]; servings: number;
}) {
  const dates = shoppingDates(start, end);
  const byDate = new Map(dinners.map((day) => [day.date, day]));
  const entries = new Map<string, { name: string; unit: string; note: string; amount: number | null; contributions: ShoppingContribution[]; unscaled: boolean }>();
  const warnings: string[] = [];
  const meals: Array<{ date: string; dinner: string | null; breakfast: string | null }> = [];
  function add(line: string, date: string, meal: string, scale: number, unscaled = false) {
    for (const ingredient of parseIngredientLine(line)) {
      const [amount, unit] = ingredient.amount === null ? [null, ""] : normalizedQuantity(ingredient.amount * scale, ingredient.unit);
      const key = JSON.stringify([ingredient.name, unit, ingredient.note, unscaled]);
      const existing = entries.get(key);
      const contribution = { date, meal, original: ingredient.original, scale };
      if (existing) {
        if (amount !== null && existing.amount !== null) existing.amount += amount;
        existing.contributions.push(contribution);
      } else entries.set(key, { name: ingredient.name, unit, note: ingredient.note, amount, contributions: [contribution], unscaled });
    }
  }
  for (const date of dates) {
    const dinner = byDate.get(date)?.recipe;
    const breakfast = breakfastForDate(breakfastVersions, date);
    meals.push({ date, dinner: dinner?.name ?? null, breakfast: breakfast?.name ?? null });
    if (!dinner) warnings.push(`${date}：夕食が未設定です。`);
    else if (!dinner.ingredientsText?.trim()) warnings.push(`${date}：${dinner.name}の材料が未登録です。メニューで確認してください。`);
    else {
      const base = dinner.servingsBase;
      const scalable = typeof base === "number" && Number.isFinite(base) && base > 0;
      if (!scalable) warnings.push(`${date}：${dinner.name}は基準人数が不明です。材料の数量を確認してください。`);
      for (const line of dinner.ingredientsText.split(/\r?\n/).filter((line) => line.trim())) {
        add(line, date, dinner.name, scalable ? servings / base : 1, !scalable);
      }
      // おかずの公式レシピに省略されている主食を、推測の数量で埋めない。
      const hasStaple = dinner.ingredientsText.split(/\r?\n/).flatMap(parseIngredientLine)
        .some((ingredient) => /^(米$|ごはん|ご飯|食パン|パン$|.*麺|.*うどん|.*そうめん|スパゲ|マカロニ)/.test(ingredient.name));
      if (!dinner.isCustom && !dinner.isCommunity && dinner.proteinSource !== "noodle" && !hasStaple) {
        add("ごはん（炊飯後） 適量", date, dinner.name, 1);
      }
    }
    if (breakfast) {
      if (!breakfast.shoppingItems.length) warnings.push(`${date}：朝食「${breakfast.name}」の買うものが未登録です。`);
      // 朝食の「買うもの」はご家庭で設定した1回分。数量があれば登場回数分を合算する。
      for (const line of breakfast.shoppingItems) add(line, date, `朝食：${breakfast.name}`, 1);
    }
  }
  const groups = new Map<string, PlannedShoppingItem[]>();
  for (const entry of entries.values()) {
    const category = ingredientCategory(entry.name);
    const count = new Set(entry.contributions.map((item) => `${item.date}:${item.meal}`)).size;
    const review = entry.amount === null || entry.unscaled;
    const quantity = entry.amount === null ? `${count}回分・数量確認` : `${formatIngredientAmount(entry.amount, entry.unit)}${entry.unscaled ? "・人数分を確認" : ""}`;
    const label = `${entry.name} ${quantity}${entry.note ? ` ${entry.note}` : ""}`;
    const items = groups.get(category) ?? [];
    // nameはDBの識別にも使う。長文も省略せず、保存キーはサーバー側で付ける。
    items.push({ category, name: label, label, position: items.length, needsReview: review, contributions: entry.contributions });
    groups.set(category, items);
  }
  return { groups: categoryOrder.filter((category) => groups.has(category)).map((category) => ({ category, items: groups.get(category)! })), warnings, meals };
}
