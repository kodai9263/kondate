import { redirect } from "next/navigation";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export async function hasAuthenticatedSession() {
  if (!isSupabaseConfigured()) return false;

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function redirectIfAuthenticated() {
  if (await hasAuthenticatedSession()) redirect("/app");
}
