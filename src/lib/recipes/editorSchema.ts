import { z } from "zod";
export const recipeImportFields = z.object({
  sourceUrl: z.string().regex(/^https:\/\/www\.kikkoman\.co\.jp\/homecook\/search\/recipe\/\d{8,12}\/$/),
  sourceServingsText: z.string().max(80),
  importConfirmed: z.literal("yes"),
});
export const recipeEditorFields = z.object({
  name: z.string().trim().min(1).max(80), side: z.string().trim().max(120),
  cookMinutes: z.number().int().min(1).max(240), servings: z.number().int().min(1).max(20),
  proteinSource: z.enum(["fish","meat","soy","egg","noodle"]),
  ingredients: z.string().trim().min(1).max(4000), morning: z.string().max(4000), steps: z.string().trim().min(1).max(4000),
  energyKcal: z.number().min(0).max(5000).optional(), proteinG: z.number().min(0).max(500).optional(), fatG: z.number().min(0).max(500).optional(), carbsG: z.number().min(0).max(1000).optional(), fiberG: z.number().min(0).max(200).optional(), saltG: z.number().min(0).max(100).optional(), vegetablesG: z.number().min(0).max(2000).optional(),
  sourceUrl: recipeImportFields.shape.sourceUrl.optional(),
  sourceServingsText: recipeImportFields.shape.sourceServingsText.optional(),
  importConfirmed: recipeImportFields.shape.importConfirmed.optional(),
}).strict().refine(fields => !fields.sourceUrl || (fields.importConfirmed === "yes" && fields.sourceServingsText !== undefined), { message: "取り込み内容を確認してください。" });
export const recipeEditorRequest = z.object({ id: z.string().uuid(), requestId: z.string().uuid(), revision: z.string().regex(/^[0-9a-f]{32}$/).nullable(), fields: recipeEditorFields }).strict();
