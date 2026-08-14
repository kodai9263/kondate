import { Home } from "lucide-react";
import Link from "next/link";
import { PricingSection } from "@/components/features/billing/PricingSection";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const { required } = await searchParams;
  let isAuthenticated = false;
  let currentPlanId: string | undefined;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
      if (profile?.household_id) {
        const { data: subscription } = await supabase.from("household_subscriptions").select("plan_id,status,current_period_end").eq("household_id", profile.household_id).maybeSingle();
        if (subscription && isActiveSubscriptionStatus(subscription.status, subscription.current_period_end)) currentPlanId = subscription.plan_id;
      }
    }
  }
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-16 pt-5">
      <Link href={isAuthenticated ? "/app" : "/"} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-black text-kondate-muted">
        <Home size={18} />
        {isAuthenticated ? "今日画面へ" : "トップへ"}
      </Link>
      <PricingSection isAuthenticated={isAuthenticated} requiredFeature={required} currentPlanId={currentPlanId} />
    </main>
  );
}
