import { normalizeAllergies } from "@/lib/family/allergies";
import { defaultFamilySize, defaultShoppingDay, normalizeFamilySize, normalizeShoppingDay } from "@/lib/family/servings";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function getCurrentHouseholdPreferences() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...defaultFamilySize, shoppingDay: defaultShoppingDay, allergies: [] };

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) return { ...defaultFamilySize, shoppingDay: defaultShoppingDay, allergies: [] };

  const { data: settings } = await supabase
    .from("household_settings")
    .select("adult_count, child_count, shopping_day, allergies")
    .eq("household_id", profile.household_id)
    .maybeSingle();

  const familySize = normalizeFamilySize(settings ? {
    adultCount: settings.adult_count,
    childCount: settings.child_count,
  } : defaultFamilySize);
  return { ...familySize, shoppingDay: normalizeShoppingDay(settings?.shopping_day), allergies: normalizeAllergies(settings?.allergies) };
}

export async function getCurrentFamilySize() {
  const { adultCount, childCount } = await getCurrentHouseholdPreferences();
  return { adultCount, childCount };
}
