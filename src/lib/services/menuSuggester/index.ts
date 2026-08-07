export type SuggestedPlan = {
  date: string;
  recipeId: string;
  reason: string;
};

export type MenuSuggesterInput = {
  householdId: string;
  weekStart: string;
  constraints: {
    allergies: string[];
    dislikes: string[];
    maxCookMinutes?: number;
    recentRecipeIds: string[];
  };
};

export interface MenuSuggester {
  suggestWeek(input: MenuSuggesterInput): Promise<SuggestedPlan[]>;
}
