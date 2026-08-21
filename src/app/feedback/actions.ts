"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { sendFeedbackEmail } from "@/lib/notifications/feedbackEmail";

const mealFeedbackSchema = z.object({
  servedOn: z.string().date(),
  recipeName: z.string().trim().min(1).max(120),
  rating: z.enum(["love", "ok", "avoid"]),
  reason: z.enum(["family_loved", "easy", "too_much", "too_little", "too_slow", "taste"]).optional(),
});

const appFeedbackSchema = z.object({
  category: z.enum(["bug", "improvement", "praise"]),
  message: z.string().trim().min(1).max(2000),
});

export async function submitMealFeedback(formData: FormData) {
  const reasonValue = String(formData.get("reason") ?? "");
  const parsed = mealFeedbackSchema.safeParse({
    servedOn: formData.get("servedOn"),
    recipeName: formData.get("recipeName"),
    rating: formData.get("rating"),
    reason: reasonValue || undefined,
  });
  if (!parsed.success) redirect("/app?mealFeedback=error");

  const context = await getFeedbackContext();
  if (!context) redirect("/login");
  const { supabase, userId, householdId } = context;
  const { error } = await supabase.from("meal_preferences").upsert({
    household_id: householdId,
    user_id: userId,
    served_on: parsed.data.servedOn,
    recipe_name: parsed.data.recipeName,
    rating: parsed.data.rating,
    reason: parsed.data.reason ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "household_id,user_id,served_on,recipe_name" });

  redirect(error ? "/app?mealFeedback=error" : "/app?mealFeedback=thanks");
}

export async function submitAppFeedback(formData: FormData) {
  const parsed = appFeedbackSchema.safeParse({
    category: formData.get("category"),
    message: formData.get("message"),
  });
  if (!parsed.success) redirect("/account?feedback=error");

  const context = await getFeedbackContext();
  if (!context) redirect("/login");
  const { supabase, userId, householdId } = context;
  const { error } = await supabase.from("app_feedback").insert({
    household_id: householdId,
    user_id: userId,
    category: parsed.data.category,
    message: parsed.data.message,
  });

  if (error) redirect("/account?feedback=error");

  const notified = await sendFeedbackEmail(parsed.data);
  if (!notified) console.error("Feedback notification could not be delivered");
  redirect("/account?feedback=thanks");
}

async function getFeedbackContext() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) return null;
  return { supabase, userId: user.id, householdId: profile.household_id };
}
