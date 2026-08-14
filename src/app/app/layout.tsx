import { redirect } from "next/navigation";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { AppBottomNav } from "@/components/features/navigation/AppBottomNav";
import { canAccessHousehold } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("ensure_current_user_household");
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).single();
  if (!profile?.household_id) redirect("/login?error=profile");

  const [{ data: subscription }, { data: firstMember }] = await Promise.all([
    supabase.from("household_subscriptions").select("status,current_period_end").eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("profiles").select("id").eq("household_id", profile.household_id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (!canAccessHousehold({ userId: user.id, firstMemberId: firstMember?.id, status: subscription?.status, currentPeriodEnd: subscription?.current_period_end })) {
    redirect("/pricing?required=family_access");
  }

  return <>{children}<AppBottomNav /></>;
}
