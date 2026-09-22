import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RecipeCookingGuide } from "@/components/features/recipes/RecipeCookingGuide";
import { TodayBoard } from "@/components/features/today/TodayBoard";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { auditedCommunityRecipe } from "@/lib/recipes/communityRecipeDetails";
import { removeDefaultSideSteps, replaceSideIngredients, resolveCustomSideSteps } from "@/lib/nutrition/sideDish";
import household from "../../scripts/data/household-seasoning-update.json";
import type { PlanMeal } from "@/types/domain";
import type { TodayTaskBindings } from "@/lib/realtime/taskState";

const menus = [
  ...officialNutritionRecipes.map((r) => ({ key: r.id, name: r.name, side: r.side, ...officialRecipeDetails[r.id] })),
  { key: "community", name: auditedCommunityRecipe.name, side: "", ...auditedCommunityRecipe.detail },
  { key: "household", name: household.name, side: "", totalMinutes: 40, notes: [], ...household.after },
];
const customSide = { id: "preview-side", name: "きゅうりの酢の物", ingredientsText: "【副菜】きゅうり 2本\n【A：甘酢】酢 大さじ2・砂糖 小さじ2", steps: ["きゅうりを薄切りにする。A（甘酢）を混ぜる", "きゅうりをA（甘酢）で和える"] };
function Preview() {
  const [key, setKey] = useState("chicken-teriyaki");
  const [mode, setMode] = useState("detail");
  const [side, setSide] = useState<"default" | "none" | "custom">("default");
  const [people, setPeople] = useState(4);
  const recipe = menus.find((r) => r.key === key)!;
  const ingredients = side === "default" ? recipe.ingredients : replaceSideIngredients(recipe.ingredients.join("\n"), recipe.side, side, customSide)!.split("\n");
  const steps = side === "default" ? recipe.steps : removeDefaultSideSteps(recipe.steps, recipe.ingredients.join("\n"), recipe.side);
  const sideSteps = side === "custom" ? resolveCustomSideSteps(customSide) : [];
  const tasks = (lines: string[], phase: string) => lines.map((text, i) => ({ text, checked: false, stepId: `${phase}-${i}`, planEntryId: "preview" }));
  const bindings: TodayTaskBindings = { breakfast: [], morning: [], seasoning: tasks(ingredients, "seasoning"), evening: tasks(steps, "evening") };
  const today: PlanMeal = { date: "2026-09-22", dayIndex: 0, dow: "火", breakfast: null, dinner: { dow: "火", dinner: recipe.name, side: side === "none" ? "副菜なし" : side === "custom" ? customSide.name : recipe.side, fish: false, kids: true, prepMin: 0, cookMin: recipe.totalMinutes, totalMin: recipe.totalMinutes, servingsBase: 4, ingredientsScalable: true, morning: [], evening: steps, seasonings: ingredients, sideSteps } };
  return <main className="mx-auto max-w-3xl px-4 pb-28 pt-5">
    <div className="mb-6 space-y-3 rounded border border-kondate-line bg-white p-4">
      <p className="text-sm text-kondate-muted">合わせ調味料のローカル表示確認（保存処理は接続していません）</p>
      <label className="block text-sm">料理<select aria-label="料理" className="mt-1 min-h-11 w-full rounded border p-2" value={key} onChange={(e) => setKey(e.target.value)}>{menus.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
      <div className="flex flex-wrap gap-3">
        <label>表示<select aria-label="表示" value={mode} onChange={(e) => setMode(e.target.value)} className="ml-2 min-h-11 border"><option value="detail">メニュー詳細</option><option value="today">今日の手順</option></select></label>
        <label>副菜<select aria-label="副菜" value={side} onChange={(e) => setSide(e.target.value as typeof side)} className="ml-2 min-h-11 border"><option value="default">標準</option><option value="none">なし</option><option value="custom">自作副菜</option></select></label>
        {mode === "today" ? <label>人数<select aria-label="今日の人数" value={people} onChange={(e) => setPeople(Number(e.target.value))} className="ml-2 min-h-11 border">{[2,4,6].map((n) => <option key={n} value={n}>{n}人分</option>)}</select></label> : null}
      </div>
    </div>
    {mode === "detail" ? <><h1 className="font-mincho text-[26px] font-bold">{recipe.name}</h1><RecipeCookingGuide key={`${key}-${side}`} ingredients={ingredients} morning={[]} steps={[...steps, ...sideSteps]} baseServings={4} totalMinutes={recipe.totalMinutes} notes={recipe.notes} scalable /></> : <TodayBoard key={`${key}-${side}`} familySize={{ adultCount: people, childCount: 0 }} today={today} initialTaskBindings={bindings} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
