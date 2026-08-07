import { Home } from "lucide-react";
import Link from "next/link";
import { PricingSection } from "@/components/features/billing/PricingSection";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  let isAuthenticated = false;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  }
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-16 pt-5">
      <Link href={isAuthenticated ? "/app" : "/"} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-black text-kondate-muted">
        <Home size={18} />
        {isAuthenticated ? "今日画面へ" : "トップへ"}
      </Link>
      <PricingSection isAuthenticated={isAuthenticated} />
    </main>
  );
}
