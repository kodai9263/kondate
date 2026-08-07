import { getSupabaseServer } from "@/lib/supabase/server";

export type BillingContext = {
  userId: string;
  email: string;
  householdId: string;
};

export async function getBillingContext(): Promise<BillingContext> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    throw new Error("unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.household_id) {
    throw new Error("profile_not_found");
  }

  return {
    userId: user.id,
    email: user.email,
    householdId: profile.household_id,
  };
}
