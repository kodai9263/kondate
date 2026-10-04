import { getMobileContext, getMobileSettings } from "@/lib/mobile/context";
import { normalizeAllergies } from "@/lib/family/allergies";
import { defaultBreakfastChoices, normalizeBreakfastChoices } from "@/lib/breakfast/preferences";
import { defaultFamilySize, defaultShoppingDay, normalizeFamilySize, normalizeShoppingDay } from "@/lib/family/servings";
import { getSupabaseServer } from "@/lib/supabase/server";

type HouseholdClient = Awaited<ReturnType<typeof getSupabaseServer>>;

export async function getCurrentHouseholdPreferences(strict = false, client?: HouseholdClient, accessToken?: string) {
  const supabase = client ?? await getSupabaseServer();
  const trusted = getMobileContext(supabase);
  const { data: { user } } = trusted ? { data: { user: trusted.user } } : await supabase.auth.getUser(accessToken);
  if (strict && !user) throw new Error("household_preferences_unavailable");
  if (!user) return { ...defaultFamilySize, shoppingDay: defaultShoppingDay, allergies: [], breakfastChoices: defaultBreakfastChoices };

  const { data: profile } = trusted ? { data: { household_id: trusted.householdId } } : await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (strict && !profile?.household_id) throw new Error("household_preferences_unavailable");
  if (!profile?.household_id) return { ...defaultFamilySize, shoppingDay: defaultShoppingDay, allergies: [], breakfastChoices: defaultBreakfastChoices };

  const { data: settings, error: settingsError } = trusted ? await getMobileSettings(supabase) : await supabase
    .from("household_settings")
    .select("adult_count, child_count, shopping_day, allergies, breakfast_choices")
    .eq("household_id", profile.household_id)
    .maybeSingle();

  if (strict && (settingsError || !settings)) throw new Error("household_preferences_unavailable");

  const familySize = normalizeFamilySize(settings ? {
    adultCount: settings.adult_count,
    childCount: settings.child_count,
  } : defaultFamilySize);
  return {
    ...familySize,
    shoppingDay: normalizeShoppingDay(settings?.shopping_day),
    allergies: normalizeAllergies(settings?.allergies),
    breakfastChoices: normalizeBreakfastChoices(settings?.breakfast_choices),
  };
}

export async function getCurrentFamilySize() {
  const { adultCount, childCount } = await getCurrentHouseholdPreferences();
  return { adultCount, childCount };
}
