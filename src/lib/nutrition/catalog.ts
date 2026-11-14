import reviewedDrafts from "./reviewedRecipes.json";
import type { NutritionRecipe } from "@/types/nutrition";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { quickWeeknightRecipes } from "@/lib/nutrition/quickWeeknightRecipes";

const imageByProteinSource: Record<NutritionRecipe["proteinSource"], string> = {
  fish: "/images/family-dinner.png",
  meat: "/images/chicken-teriyaki.png",
  soy: "/images/tofu-hamburg.png",
  egg: "/images/tofu-hamburg.png",
  noodle: "/images/udon.png",
};

export const officialNutritionRecipes: NutritionRecipe[] = [
  ...quickWeeknightRecipes.map((item) => recipe(
    item.id, item.name, item.side, item.cookMinutes, item.proteinSource,
    item.nutrition.energyKcal, item.nutrition.proteinG, item.nutrition.fatG,
    item.nutrition.carbsG, item.nutrition.fiberG, item.nutrition.saltG,
    item.nutrition.vegetablesG,
  )),
  ...reviewedDrafts.map((item): NutritionRecipe => ({
    id: `reviewed-${item.key.toLowerCase()}`, name: item.name, side: "",
    cookMinutes: item.totalMinutes, totalMinutes: item.totalMinutes,
    servingsBase: item.servings, proteinSource: item.proteinSource as NutritionRecipe["proteinSource"],
    imageUrl: "", nutrition: null, ingredientsText: item.ingredients.join("\n"),
    eveningSteps: item.steps, recipeNotes: item.notes, seasonMonths: [],
  })),
];

function recipe(
  id: string,
  name: string,
  side: string,
  cookMinutes: number,
  proteinSource: NutritionRecipe["proteinSource"],
  energyKcal: number,
  proteinG: number,
  fatG: number,
  carbsG: number,
  fiberG: number,
  saltG: number,
  vegetablesG: number,
  seasonMonths: number[] = [],
): NutritionRecipe {
  const detail = officialRecipeDetails[id];

  if (!detail) {
    throw new Error(`公式献立の詳細がありません: ${id}`);
  }

  return {
    id,
    name,
    side,
    cookMinutes,
    totalMinutes: detail.totalMinutes,
    recipeNotes: detail.notes,
    servingsBase: 4,
    proteinSource,
    imageUrl: imageByProteinSource[proteinSource],
    nutrition: { energyKcal, proteinG, fatG, carbsG, fiberG, saltG, vegetablesG },
    ingredientsText: detail.ingredients.join("\n"),
    eveningSteps: detail.steps,
    seasonMonths,
  };
}
