import type { NutritionRecipe } from "@/types/nutrition";

export const heldRecipeMessage = "この料理の材料・作り方は現在確認中です。献立から別の主菜を選んでください。";

// 保存済みの予定を別の料理で置き換えず、本文のない記録として表示する。
export function heldRecipePlaceholder(row: { recipe_id: string; recipe_name: string }): NutritionRecipe {
  return { id: row.recipe_id, name: `${row.recipe_name}（内容の確認中）`, side: "", cookMinutes: 0,
    proteinSource: "meat", imageUrl: "", nutrition: null, ingredientsText: "", eveningSteps: [heldRecipeMessage],
    archived: true, timeUnconfirmed: true, contentUnavailable: true };
}
