import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { auditedCommunityRecipe } from "@/lib/recipes/communityRecipeDetails";
import { getSeasoningGroups, getStepSeasoningIds, getStepSeasoningGroups, scopeSideSeasonings } from "@/lib/recipes/seasoningGroups";
import { removeDefaultSideSteps, replaceSideIngredients, resolveCustomSideSteps } from "@/lib/nutrition/sideDish";
import { parseIngredientLine } from "@/lib/shopping/ingredients";
import { scaleRecipeIngredient } from "@/lib/family/servings";
import { StepSeasoningGuide } from "@/components/features/recipes/SeasoningGuide";
import originalTotals from "./fixtures/seasoning-ingredient-totals.json";
import householdUpdate from "../scripts/data/household-seasoning-update.json";
import { buildTodayTaskBindings, mergeTodayPlan, type DailyPlanRow } from "@/lib/today/server";
import { findTodayPlan } from "@/lib/services/planService";
import { menuData } from "@/lib/menuData";

const recipes = [...Object.entries(officialRecipeDetails), ["community", auditedCommunityRecipe.detail] as const, ["household", householdUpdate.after] as const];

describe("合わせ調味料と投入工程", () => {
  it.each(recipes)("%s: すべての記号に材料と使用工程があり、分量も読み取れる", (_key, recipe) => {
    const groups = getSeasoningGroups(recipe.ingredients);
    const definitions = groups.map((group) => group.id);
    const references = recipe.steps.flatMap(getStepSeasoningIds);
    expect(new Set(references)).toEqual(new Set(definitions));
    for (const group of groups) {
      expect(group.ingredients.length).toBeGreaterThan(0);
      expect(group.ingredients.join("・")).toMatch(/大さじ|小さじ|ml|本|カップ|g/);
      const first = recipe.steps.find((step) => getStepSeasoningIds(step).includes(group.id))!;
      expect(first).toMatch(/混ぜ|入れ|加え|もみ/);
    }
  });

  it.each(Object.entries(officialRecipeDetails))("%s: 調味料を分けても食材ごとの合計量を変えない", (key, recipe) => {
    const sums = new Map<string, number>();
    for (const item of recipe.ingredients.flatMap(parseIngredientLine)) {
      const key = JSON.stringify([item.name, item.unit, item.amount === null ? item.original : ""]);
      sums.set(key, (sums.get(key) ?? 0) + (item.amount ?? 0));
    }
    const hash = createHash("sha256").update(JSON.stringify([...sums].sort(([a], [b]) => a.localeCompare(b, "en")))).digest("hex");
    expect(hash).toBe(originalTotals[key as keyof typeof originalTotals]);
  });

  it.each(officialNutritionRecipes)("$id: 副菜なしでも主菜の記号を残し、副菜だけの記号参照は残さない", (recipe) => {
    const detail = officialRecipeDetails[recipe.id];
    const ingredients = replaceSideIngredients(detail.ingredients.join("\n"), recipe.side, "none", null)?.split("\n") ?? [];
    const steps = removeDefaultSideSteps(detail.steps, detail.ingredients.join("\n"), recipe.side);
    const groups = getSeasoningGroups(ingredients);
    const mainIds = getSeasoningGroups(detail.ingredients).filter((group) => group.name.startsWith("主菜の")).map((group) => group.id);
    expect(groups.map((group) => group.id)).toEqual(mainIds);
    expect(new Set(steps.flatMap(getStepSeasoningIds))).toEqual(new Set(mainIds));
    for (const id of mainIds) {
      const countUses = (rows: string[]) => rows.flatMap((row) => row.split(/(?<=。)/)).filter((sentence) => getStepSeasoningIds(sentence).includes(id)).length;
      expect(countUses(steps), `${id}の準備・投入・仕上げをすべて保持`).toBe(countUses(detail.steps));
    }
    const row: DailyPlanRow = {
      plan_entry_id: "entry", meal_type: "dinner", recipe_name: recipe.name, prep_minutes: 0, cook_minutes: detail.totalMinutes,
      side_mode: "none", meta: { side: recipe.side },
      steps: [
        ...detail.ingredients.map((text, i) => ({ id: `ingredient-${i}`, phase: "seasoning" as const, text, checked: true })),
        ...detail.steps.map((text, i) => ({ id: `step-${i}`, phase: "evening" as const, text, checked: true })),
      ],
    };
    const bindings = buildTodayTaskBindings(mergeTodayPlan(findTodayPlan(menuData), [row]), [row]);
    expect([...bindings.evening, ...bindings.seasoning].every((task) => task.stepId && task.checked)).toBe(true);
  });

  it("副菜を外しても主菜の下ごしらえと仕上げを省略しない", () => {
    const main = (key: string) => {
      const recipe = officialNutritionRecipes.find((r) => r.id === key)!;
      return removeDefaultSideSteps(officialRecipeDetails[key].steps, recipe.ingredientsText, recipe.side).join("\n");
    };
    expect(main("tofu-mapo")).toContain("長ねぎを加えて1分温め");
    expect(main("tofu-mapo")).not.toContain("硬ければ30秒");
    expect(main("udon")).toContain("鶏肉は2cm角");
    expect(main("pork-ginger-bowl")).toContain("丼用キャベツは千切り");
    expect(main("black-fried-rice")).toContain("チャーハン用の卵をボウルに溶く");
    expect(main("lotus-chicken-balls")).toContain("つくね用長ねぎはみじん切り");
    expect(main("pork-soup")).toContain("A（主菜の焼きおにぎりのたれ）");
    expect(main("cod-steam")).not.toContain("12〜15分煮る");
    expect(main("corn-chicken-rice")).not.toContain("溶き卵");
    expect(main("fried-chicken-black-vinegar")).toContain("鶏肉を加えて主菜のあんを絡め");
  });

  it("炒め油・後入れの醤油・仕上げの味噌・衣用の粉を混ぜない", () => {
    expect(getSeasoningGroups(officialRecipeDetails["taco-rice"].ingredients)[0].ingredients.flatMap(parseIngredientLine).map((item) => item.name)).not.toContain("油");
    expect(getSeasoningGroups(officialRecipeDetails.nikujaga.ingredients)[0].ingredients.join("・")).not.toContain("醤油");
    expect(getSeasoningGroups(officialRecipeDetails["mackerel-miso"].ingredients)[0].ingredients.join("・")).toContain("味噌 大さじ1.5");
    expect(officialRecipeDetails["mackerel-miso"].ingredients).toContain("【主菜の仕上げ】味噌 大さじ1.5");
    expect(getSeasoningGroups(officialRecipeDetails["liver-chive-stir-fry"].ingredients)[0].ingredients.join("・")).not.toContain("片栗粉");
    expect(officialRecipeDetails["fried-chicken-black-vinegar"].steps.join("\n")).toContain("底から混ぜ直し");
  });

  it("分けて炒める料理では、その回の分だけを加える", () => {
    for (const key of ["sardine-bowl", "vegetable-yakisoba", "napolitan", "yaki-udon", "black-fried-rice"]) {
      expect(officialRecipeDetails[key].steps.some((step) => /その回の.*A.*全量加え/.test(step)), key).toBe(true);
    }
  });

  it("人数を変えた工程補足にも換算後の量を使い、時間や温度を記号と誤認しない", () => {
    const groups = getSeasoningGroups(officialRecipeDetails["chicken-teriyaki"].ingredients.map((line) => scaleRecipeIngredient(line, 2, 4)));
    const html = renderToStaticMarkup(<StepSeasoningGuide step="A（主菜の照りだれ）を全量加える" groups={groups} />);
    expect(html).toContain("醤油 大さじ1と1/2");
    expect(html).not.toContain("醤油 大さじ3");
    expect(getStepSeasoningIds("600Wで加熱し、75℃を確かめる。ABCを読む")).toEqual([]);
    expect(getStepSeasoningIds("【Ａ】とB を混ぜる")).toEqual(["A", "B"]);
    expect(getStepSeasoningGroups("Bを入れる", groups)).toEqual([]);
  });

  it("複数行の同じ調味料をまとめ、矛盾した記号の中身は推測しない", () => {
    const groups = getSeasoningGroups(auditedCommunityRecipe.detail.ingredients);
    expect(groups).toHaveLength(1);
    expect(groups[0].ingredients).toHaveLength(2);
    expect(getSeasoningGroups(["【A：たれ】醤油 大さじ1", "【A：和え衣】砂糖 小さじ1"])).toEqual([]);
    expect(getSeasoningGroups(["醤油 大さじ1", "材料未登録"])).toEqual([]);
  });

  it("主菜のAと自作副菜のAを区別し、別の材料を工程に表示しない", () => {
    const side = { id: "side", name: "和え物", ingredientsText: "【A：和え衣】酢 大さじ1・砂糖 小さじ1", steps: ["A（和え衣）を混ぜる", "野菜をAで和える"] };
    const detail = officialRecipeDetails["chicken-teriyaki"];
    const combined = replaceSideIngredients(detail.ingredients.join("\n"), "味噌汁", "custom", side)!.split("\n");
    const groups = getSeasoningGroups(combined);
    expect(groups.map((group) => group.id)).toEqual(["A", "副菜A"]);
    const steps = resolveCustomSideSteps(side);
    expect(getStepSeasoningGroups(steps[1], groups).map((group) => group.id)).toEqual(["副菜A"]);
    const scoped = scopeSideSeasonings(combined, steps);
    expect(scoped.steps).toEqual(steps);
  });
});
