"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { firstWeekDates, normalizeRecipeSelection } from "@/lib/billing/firstWeek";
import { normalizeAllergies, parseCustomAllergies } from "@/lib/family/allergies";

export async function configureFirstWeek(formData: FormData) {
  const recipe = normalizeRecipeSelection(formData.get("recipe"));
  const suffix = recipe ? `&recipe=${encodeURIComponent(recipe)}` : "";
  const parsed = z.object({ adults: z.coerce.number().int().min(1).max(10), children: z.coerce.number().int().min(0).max(10), start: z.string().date(), confirmed: z.literal("yes") }).safeParse({ adults: formData.get("adults"), children: formData.get("children"), start: formData.get("start"), confirmed: formData.get("confirmed") });
  if (!parsed.success) redirect(`/app/planner/setup?error=invalid${suffix}`);
  try { firstWeekDates(parsed.data.start); } catch { redirect(`/app/planner/setup?error=invalid${suffix}`); }
  const allergens = normalizeAllergies([...formData.getAll("allergies"), ...parseCustomAllergies(formData.get("otherAllergies"))]);
  if (allergens.length > 30) redirect(`/app/planner/setup?error=invalid${suffix}`);
  const { supabase, canPlan } = await getFirstWeekAccess();
  if (!canPlan) redirect("/pricing?required=trial_expired");
  const { error } = await supabase.rpc("configure_first_week", { start_input: parsed.data.start, adults: parsed.data.adults, children: parsed.data.children, allergens });
  if (error) redirect(`/app/planner/setup?error=save${suffix}`);
  revalidatePath("/app");
  redirect(`/app/planner?view=week&date=${parsed.data.start}${recipe ? `&recipe=${encodeURIComponent(recipe)}` : ""}`);
}
