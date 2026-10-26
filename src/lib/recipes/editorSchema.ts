import { z } from "zod";
export const recipeEditorFields = z.object({
  name: z.string().trim().min(1).max(80), side: z.string().trim().max(120),
  cookMinutes: z.number().int().min(1).max(240), servings: z.number().int().min(1).max(20),
  proteinSource: z.enum(["fish","meat","soy","egg","noodle"]),
  ingredients: z.string().trim().min(1).max(4000), morning: z.string().max(4000), steps: z.string().trim().min(1).max(4000),
  energyKcal: z.number().min(0).max(5000).optional(), proteinG: z.number().min(0).max(500).optional(), fatG: z.number().min(0).max(500).optional(), carbsG: z.number().min(0).max(1000).optional(), fiberG: z.number().min(0).max(200).optional(), saltG: z.number().min(0).max(100).optional(), vegetablesG: z.number().min(0).max(2000).optional(),
}).strict();
export const recipeEditorRequest = z.object({ id: z.string().uuid(), requestId: z.string().uuid(), revision: z.string().regex(/^[0-9a-f]{32}$/).nullable(), fields: recipeEditorFields }).strict();
