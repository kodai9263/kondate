import type { User } from "@supabase/supabase-js";
import type { getSupabaseServer } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof getSupabaseServer>>;
type Context = { user: User; householdId: string; subscription: { status: string; current_period_end: string | null } | null };
// クライアントはリクエストごとに作成され、他の利用者へ情報を共有しない。
const contexts = new WeakMap<Client, Context>();
const settings = new WeakMap<Client, ReturnType<typeof readSettings>>();
export function registerMobileContext(client: Client, context: Context) { contexts.set(client, context); }
export function getMobileContext(client: Client) { return contexts.get(client); }
function readSettings(client: Client, householdId: string) {
  return Promise.resolve(client.from("household_settings")
    .select("adult_count,child_count,shopping_day,allergies,breakfast_choices,shopping_period_mode,shopping_range_start,shopping_range_end")
    .eq("household_id", householdId).maybeSingle());
}
export function getMobileSettings(client: Client) {
  const context = contexts.get(client);
  if (!context) throw new Error("mobile_context_required");
  let pending = settings.get(client);
  if (!pending) { pending = readSettings(client, context.householdId); settings.set(client, pending); }
  return pending;
}
