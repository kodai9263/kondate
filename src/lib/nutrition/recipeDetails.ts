import reviewedDrafts from "./reviewedRecipes.json";
import { quickWeeknightRecipeDetails } from "@/lib/nutrition/quickWeeknightRecipes";

export type OfficialRecipeDetail = {
  ingredients: string[];
  steps: string[];
  /** 下ごしらえ・待ち時間を含む、4人分の完成までの目安。実測値ではない。 */
  totalMinutes: number;
  notes: string[];
};

// 作成履歴を確認した本文だけを公開する。旧本文はDBで保留し、保存済み献立の参照を維持する。
export const officialRecipeDetails: Record<string, OfficialRecipeDetail> = {
  ...quickWeeknightRecipeDetails,
  ...Object.fromEntries(reviewedDrafts.map((item) => [`reviewed-${item.key.toLowerCase()}`, {
    ingredients: item.ingredients, steps: item.steps, totalMinutes: item.totalMinutes, notes: item.notes,
  }])),
};
