export type ProteinSource = "fish" | "meat" | "soy" | "egg" | "noodle";

export type Nutrition = {
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  saltG: number;
  vegetablesG: number;
};

export type NutritionRecipe = {
  id: string;
  name: string;
  side: string;
  cookMinutes: number;
  proteinSource: ProteinSource;
  imageUrl: string;
  nutrition: Nutrition;
  ingredientsText?: string;
  eveningSteps?: string[];
  seasonMonths?: number[];
  isCustom?: boolean;
};

export type PlannedDinner = {
  date: string;
  recipe: NutritionRecipe;
  locked: boolean;
};

export type NutritionSummary = {
  average: Nutrition;
  score: number;
  message: string;
};
