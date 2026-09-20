import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { buildPlannedShopping } from "@/lib/shopping/build";
import { parseIngredientLine } from "@/lib/shopping/ingredients";
import { formatShoppingPeriod, getShoppingPeriod, isShoppingRange, shoppingDates } from "@/lib/shopping/period";
import type { BreakfastVersion } from "@/lib/breakfast/settings";

const recipe = (id: string) => officialNutritionRecipes.find((recipe) => recipe.id === id)!;
const dinner = (id: string, date = "2026-09-19") => ({ date, recipe: recipe(id), locked: false });
const breakfast = (shoppingItems: string[]): BreakfastVersion => ({ revision: "test", effective_date: "2026-01-01", rotation_start: "2026-01-01", legacy_rotation: false,
  enabled: true, items: [{ id: "test", name: "朝食", sourceKey: null, tasks: [], minutes: null, shoppingItems }] });
const build = (dinners: ReturnType<typeof dinner>[], breakfastVersions: BreakfastVersion[] = [], servings = 4) => buildPlannedShopping({ start: "2026-09-19", dinners, breakfastVersions, servings });
const labels = (result: ReturnType<typeof build>) => result.groups.flatMap((group) => group.items.map((item) => item.label));

describe("買い物の7日間", () => {
  it("買い物曜日の当日から6日後まで、日本時間0時に切り替える", () => {
    expect(getShoppingPeriod(6, new Date("2026-09-18T14:59:59Z"))).toMatchObject({ start: "2026-09-12", end: "2026-09-18" });
    expect(getShoppingPeriod(6, new Date("2026-09-18T15:00:00Z"))).toMatchObject({ start: "2026-09-19", end: "2026-09-25", storageWeekStart: "2026-09-20" });
  });
  it.each([0, 1, 2, 3, 4, 5, 6])("買い物曜日%dは週途中・日曜でも過去直近のその曜日を選ぶ", (day) => {
    const range = getShoppingPeriod(day, new Date("2026-09-23T12:00:00+09:00"));
    expect(new Date(`${range.start}T12:00:00`).getDay()).toBe(day);
    expect(range.start <= "2026-09-23" && range.end >= "2026-09-23").toBe(true);
    expect(shoppingDates(range.start)).toHaveLength(7);
  });
  it("今日だけは日本時間の日付変更に追従する", () => {
    expect(getShoppingPeriod(6, new Date("2026-09-23T14:59:59Z"), { mode: "today" })).toMatchObject({ mode: "today", start: "2026-09-23", end: "2026-09-23" });
    expect(getShoppingPeriod(6, new Date("2026-09-23T15:00:00Z"), { mode: "today" })).toMatchObject({ start: "2026-09-24", end: "2026-09-24" });
  });
  it("指定期間は次の買い物曜日や年が変わっても保持する", () => {
    const selection = { mode: "custom" as const, start: "2026-09-22", end: "2026-10-04" };
    for (const now of ["2026-09-23", "2026-09-26", "2027-01-01"]) {
      expect(getShoppingPeriod(6, new Date(`${now}T12:00:00+09:00`), selection)).toMatchObject(selection);
    }
  });
  it.each([
    ["2026-02-31", "2026-03-05"], ["bad", "2026-09-23"], ["2026-09-25", "2026-09-23"],
    ["2026-01-01", "2027-01-02"], ["", ""], ["0000-01-01", "0000-01-02"],
  ])("不正な期間 %s〜%s を拒否し、勝手に別期間へ置き換えない", (start, end) => {
    expect(isShoppingRange(start, end)).toBe(false);
    expect(() => getShoppingPeriod(6, new Date("2026-09-23"), { mode: "custom", start, end })).toThrow("invalid_shopping_range");
    expect(() => shoppingDates(start, end)).toThrow("invalid_shopping_range");
  });
  it("同日指定・未来の指定・366日までを受け付ける", () => {
    expect(shoppingDates("2026-09-23", "2026-09-23")).toEqual(["2026-09-23"]);
    expect(shoppingDates("2027-01-01", "2028-01-01")).toHaveLength(366);
    expect(formatShoppingPeriod("2026-09-23", "2026-09-23")).toBe("9/23（水）");
    expect(formatShoppingPeriod("2026-12-31", "2027-01-01")).toBe("2026/12/31（木）〜2027/1/1（金）");
  });
  it("期間の選び方だけでは手動品の保存先を変えない", () => {
    const now = new Date("2026-09-23T12:00:00+09:00");
    const storage = getShoppingPeriod(6, now).storageWeekStart;
    expect(getShoppingPeriod(6, now, { mode: "today" }).storageWeekStart).toBe(storage);
    expect(getShoppingPeriod(6, now, { mode: "custom", start: "2027-01-01", end: "2027-01-10" }).storageWeekStart).toBe(storage);
  });
  it("月末・年末・うるう日も7日ちょうどにする", () => {
    expect(shoppingDates("2026-12-29").at(-1)).toBe("2027-01-04");
    expect(shoppingDates("2028-02-26")).toContain("2028-02-29");
  });
});

describe("献立からの材料集計", () => {
  it.each([
    ["2026-09-19", "2026-09-19", 1],
    ["2026-09-19", "2026-09-25", 7],
    ["2026-09-25", "2026-10-08", 14],
    ["2026-12-31", "2027-01-02", 3],
  ])("%s〜%sの夕食と朝食を最終日まで%d日分集計する", (start, end, days) => {
    const dates = shoppingDates(start, end);
    const dinners = [...dates, "2028-01-01"].map((date) => ({ ...dinner("hamburg", date),
      recipe: { ...recipe("hamburg"), ingredientsText: "にんじん 1本", servingsBase: 4, isCustom: true },
    }));
    const result = buildPlannedShopping({ start, end, dinners, breakfastVersions: [breakfast(["卵 2個"])], servings: 4 });
    expect(result.meals.map((meal) => meal.date)).toEqual(dates);
    expect(labels(result)).toContain(`にんじん ${days}本`);
    expect(labels(result)).toContain(`卵 ${days * 2}個`);
    expect(result.warnings).toEqual([]);
    expect(result.groups.flatMap((group) => group.items).every((item) => item.contributions.length === days)).toBe(true);
  });
  it("主菜に加え副菜・汁物・調味料を材料欄から含める", () => {
    const result = labels(build([dinner("hamburg")]));
    for (const name of ["合いびき肉", "卵", "パン粉", "牛乳", "ケチャップ", "中濃ソース", "ブロッコリー", "コーン", "マヨネーズ", "玉ねぎ"]) expect(result.some((line) => line.includes(name)), name).toBe(true);
  });
  it("調味料は分量・少々・適量の注記をまとめて名前だけにし、材料の根拠を残す", () => {
    const dinners = [
      { ...dinner("hamburg"), recipe: { ...recipe("hamburg"), isCustom: true,
        ingredientsText: "塩 小さじ0.5\n塩 少々\n油 適量(フライパンと手に薄く塗る)\nにんじん 1本" } },
      { ...dinner("hamburg", "2026-09-20"), recipe: { ...recipe("hamburg"), isCustom: true,
        ingredientsText: "塩 大さじ1\n油 小さじ1\nにんじん 1本" } },
    ];
    const originals = dinners.map((day) => day.recipe.ingredientsText);
    const result = build(dinners, [], 2);
    const seasonings = result.groups.find((group) => group.category === "調味料(在庫確認)")!.items;
    expect(seasonings.map(({ label, name, position }) => ({ label, name, position }))).toEqual([
      { label: "塩", name: "塩", position: 0 }, { label: "油", name: "油", position: 1 },
    ]);
    expect(seasonings[0].contributions).toHaveLength(3);
    expect(seasonings[0].contributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2026-09-19", meal: recipe("hamburg").name, original: "塩 小さじ0.5", scale: 0.5 }),
      expect.objectContaining({ date: "2026-09-19", meal: recipe("hamburg").name, original: "塩 少々", scale: 0.5 }),
      expect.objectContaining({ date: "2026-09-20", meal: recipe("hamburg").name, original: "塩 大さじ1", scale: 0.5 }),
    ]));
    expect(seasonings[1].contributions.map((source) => source.original)).toEqual([
      "油 適量(フライパンと手に薄く塗る)", "油 小さじ1",
    ]);
    expect(seasonings.every((item) => item.needsReview)).toBe(true);
    expect(labels(result)).toContain("にんじん 1本");
    expect(dinners.map((day) => day.recipe.ingredientsText)).toEqual(originals);
  });
  it("調味料の表記ゆれをまとめ、異なる油や塩こしょうは別品として残す", () => {
    const result = build([], [breakfast([
      "サラダ油 大さじ1", "油 少々", "オリーブ油 大さじ1", "ごま油 小さじ1",
      "塩こしょう 少々", "塩 少々", "胡椒 少々", "こしょう 小さじ1", "しょうゆ 大さじ1", "醤油 小さじ1",
    ])]);
    const seasonings = result.groups.find((group) => group.category === "調味料(在庫確認)")!.items;
    expect(seasonings.map((item) => item.label)).toEqual(["油", "オリーブ油", "ごま油", "塩こしょう", "塩", "こしょう", "醤油"]);
    for (const name of ["油", "こしょう", "醤油"]) {
      expect(seasonings.find((item) => item.label === name)!.contributions).toHaveLength(14);
    }
  });
  it("基準人数が不明な調味料も一行にまとめ、人数確認の根拠と警告を残す", () => {
    const result = build([
      { ...dinner("hamburg"), recipe: { ...recipe("hamburg"), isCustom: true, ingredientsText: "塩 小さじ1\n酢 小さじ1" } },
      { ...dinner("hamburg", "2026-09-20"), recipe: { ...recipe("hamburg"), isCustom: true,
        servingsBase: undefined, ingredientsText: "塩 小さじ1" } },
    ]);
    const seasonings = result.groups.find((group) => group.category === "調味料(在庫確認)")!.items;
    expect(seasonings.map(({ label, needsReview }) => ({ label, needsReview }))).toEqual([
      { label: "塩", needsReview: true }, { label: "酢", needsReview: false },
    ]);
    expect(seasonings[0].contributions).toHaveLength(2);
    expect(result.warnings.some((warning) => warning.includes("基準人数が不明"))).toBe(true);
  });
  it("材料変更・献立差し替えと対象期間外の除外を反映する", () => {
    const before = labels(build([dinner("hamburg"), dinner("salmon", "2026-09-26")]));
    expect(before.some((line) => line.startsWith("生鮭"))).toBe(false);
    const after = labels(build([dinner("salmon")]));
    expect(after).toContain("生鮭 4切れ");
    expect(after.some((line) => line.includes("合いびき肉"))).toBe(false);
  });
  it("同じ食材を主菜・汁物・別日で合計し、人数に合わせる", () => {
    const result = labels(build([dinner("salmon"), dinner("salmon", "2026-09-20")], [], 2));
    expect(result).toContain("生鮭 4切れ");
    expect(result).toContain("大根 13cm");
    expect(result).toContain("にんじん 0.5本");
  });
  it("朝食の1回分を出現回数で合計し、夕食の同じ材料とも合算する", () => {
    const result = labels(build([dinner("hamburg")], [breakfast(["卵 2個", "牛乳 200ml"])]));
    expect(result).toContain("卵 15個");
    expect(result).toContain("牛乳 1400ml");
    // mlとさじは密度や換算を決めず、異なる単位のまま残す。
    expect(result.some((line) => line === "牛乳 大さじ3")).toBe(true);
  });
  it("購入済みの利用日だけを差し引き、期間を延ばした分は新しく表示する", () => {
    const dinners = ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"].map((date) => ({
      date, locked: false, recipe: { ...recipe("hamburg"), name: "夕食", ingredientsText: "にんじん 1本", servingsBase: 4, isCustom: true },
    }));
    const first = buildPlannedShopping({ start: "2026-09-19", end: "2026-09-21", dinners, breakfastVersions: [], servings: 4 });
    const bought = first.groups[0].items[0].contributions.filter((contribution) => contribution.date < "2026-09-21").map((contribution) => contribution.key);
    const sameRange = buildPlannedShopping({ start: "2026-09-19", end: "2026-09-21", dinners, breakfastVersions: [], servings: 4, purchasedContributionKeys: bought });
    const extended = buildPlannedShopping({ start: "2026-09-19", end: "2026-09-22", dinners, breakfastVersions: [], servings: 4, purchasedContributionKeys: bought });
    expect(labels(sameRange)).toEqual(["にんじん 1本"]);
    expect(sameRange.groups[0].items[0].contributions.map((contribution) => contribution.date)).toEqual(["2026-09-21"]);
    expect(labels(extended)).toEqual(["にんじん 2本"]);
  });
  it("翌週の同じ食材や購入後に変更した献立は消さない", () => {
    const oldDinner = { date: "2026-09-19", locked: false, recipe: { ...recipe("hamburg"), name: "旧献立", ingredientsText: "卵 1個", servingsBase: 4, isCustom: true } };
    const boughtKey = buildPlannedShopping({ start: "2026-09-19", end: "2026-09-19", dinners: [oldDinner], breakfastVersions: [], servings: 4 })
      .groups[0].items[0].contributions[0].key;
    const changed = { ...oldDinner, recipe: { ...oldDinner.recipe, name: "新献立" } };
    const nextWeek = { ...oldDinner, date: "2026-09-26" };
    expect(labels(buildPlannedShopping({ start: "2026-09-19", end: "2026-09-19", dinners: [changed], breakfastVersions: [], servings: 4, purchasedContributionKeys: [boughtKey] }))).toEqual(["卵 1個"]);
    expect(labels(buildPlannedShopping({ start: "2026-09-26", end: "2026-09-26", dinners: [nextWeek], breakfastVersions: [], servings: 4, purchasedContributionKeys: [boughtKey] }))).toEqual(["卵 1個"]);
  });
  it("朝食の週途中の変更・無効化をその日から反映する", () => {
    const old = breakfast(["卵 2個"]);
    const next = { ...breakfast(["牛乳 200ml"]), effective_date: "2026-09-22" };
    const off = { ...next, effective_date: "2026-09-24", enabled: false };
    expect(labels(build([], [old, next, off]))).toEqual(["卵 6個", "牛乳 400ml"]);
  });
  it("単位をそろえ、木綿と絹・生米と炊飯後の米を混ぜない", () => {
    const result = labels(build([], [breakfast(["豚こま肉 0.1kg", "豚こま 200g", "木綿豆腐 1丁", "絹ごし豆腐 1丁", "米 1合", "温かいごはん 100g"])]));
    expect(result).toContain("豚こま肉 2100g");
    expect(result).toContain("木綿豆腐 7丁");
    expect(result).toContain("絹ごし豆腐 7丁");
    expect(result).toContain("米 7合");
    expect(result).toContain("ごはん（炊飯後） 700g");
  });
  it("数量なし・不明な表記は消さず、回数と原文を残す", () => {
    const result = build([], [breakfast(["果物", "卵 1〜2個", "牛乳 1本（500ml）"])]);
    for (const item of result.groups.flatMap((group) => group.items)) expect(item.contributions).toHaveLength(7);
    expect(labels(result)).toContain("果物 7回分・数量確認");
    expect(labels(result)).toContain("卵 1〜2個 7回分・数量確認");
  });
  it("基準人数がない自作レシピを勝手に人数換算しない", () => {
    const result = build([{ ...dinner("hamburg"), recipe: { ...recipe("hamburg"), servingsBase: undefined, isCustom: true, ingredientsText: "合いびき肉 300g" } }]);
    expect(labels(result)).toEqual(["合いびき肉 300g・人数分を確認"]);
    expect(result.warnings.some((warning) => warning.includes("基準人数が不明"))).toBe(true);
  });
  it.each(officialNutritionRecipes)("公式94品の材料を捨てず数量表記を解釈する：$id", (recipe) => {
    const result = build([{ date: "2026-09-19", recipe, locked: false }]);
    const contributions = result.groups.flatMap((group) => group.items.flatMap((item) => item.contributions));
    for (const line of recipe.ingredientsText!.split("\n")) {
      for (const ingredient of parseIngredientLine(line)) {
        expect(contributions.some((source) => source.original === ingredient.original), ingredient.original).toBe(true);
        if (!/適量|少々/.test(ingredient.original)) expect(ingredient.amount, ingredient.original).not.toBeNull();
      }
    }
  });
});

describe("保存した献立と集計の一致", () => {
  it("月またぎでも保存した差し替えを優先する", () => {
    const context = { recipes: officialNutritionRecipes, preferredRecipeIds: [], initialRecipeIds: { "2026-09-30": "hamburg", "2026-10-01": "salmon" }, initialLockedRecipeIds: {} };
    const dinners = [resolveMonthlyDinnerPlan(2026, 9, context), resolveMonthlyDinnerPlan(2026, 10, context)].flat();
    const result = buildPlannedShopping({ start: "2026-09-29", dinners, breakfastVersions: [], servings: 4 });
    expect(result.meals).toHaveLength(7);
    expect(result.meals.find((day) => day.date === "2026-09-30")?.dinner).toBe(recipe("hamburg").name);
    expect(result.meals.find((day) => day.date === "2026-10-01")?.dinner).toBe(recipe("salmon").name);
    expect(result.warnings).toEqual([]);
  });
});
