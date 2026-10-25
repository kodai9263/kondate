import { z } from "zod";
export const recipeEditorFields = z.object({
  name: z.string().trim().min(1).max(80), side: z.string().trim().max(120),
  cookMinutes: z.number().int().min(1).max(240), servings: z.number().int().min(1).max(20),
  proteinSource: z.enum(["fish","meat","soy","egg","noodle"]),
  ingredients: z.string().trim().min(1).max(4000), morning: z.string().max(4000), steps: z.string().trim().min(1).max(4000),
  energyKcal: z.number().min(0).max(5000), proteinG: z.number().min(0).max(500), fatG: z.number().min(0).max(500), carbsG: z.number().min(0).max(1000), fiberG: z.number().min(0).max(200), saltG: z.number().min(0).max(100), vegetablesG: z.number().min(0).max(2000),
}).strict();
export const recipeEditorRequest = z.object({ id: z.string().uuid(), requestId: z.string().uuid(), revision: z.string().regex(/^[0-9a-f]{32}$/).nullable(), fields: recipeEditorFields }).strict();
