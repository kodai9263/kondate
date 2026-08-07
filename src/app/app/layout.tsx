import { redirect } from "next/navigation";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { AppBottomNav } from "@/components/features/navigation/AppBottomNav";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("ensure_current_user_household");
  return <>{children}<AppBottomNav /></>;
}
