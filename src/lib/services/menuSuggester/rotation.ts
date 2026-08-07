import type { MenuSuggester, MenuSuggesterInput, SuggestedPlan } from "./index";

export class RotationSuggester implements MenuSuggester {
  async suggestWeek(input: MenuSuggesterInput): Promise<SuggestedPlan[]> {
    return [
      {
        date: input.weekStart,
        recipeId: "rotation-template",
        reason: "MVPでは公式4週間ローテーションを決定的に展開します",
      },
    ];
  }
}
