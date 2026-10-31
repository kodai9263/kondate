import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createMobileRequestClient } from "@/lib/supabase/mobile";
import type { normalizeAppleTransaction } from "./transaction";

export async function applePurchaseIdentity(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/)?.[1];
  if (!token) throw new Error("unauthenticated");
  const client = createMobileRequestClient(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error("unauthenticated");
  if (user.is_anonymous) throw new Error("registration_required");
  const { data: profile, error: profileError } = await client.from("profiles").select("household_id").eq("id", user.id).single();
  if (profileError || !profile?.household_id) throw new Error("household_unavailable");
  return { userId: user.id, householdId: profile.household_id as string, client };
}

export async function purchaseAccount(identity: { userId: string; householdId: string }) {
  const admin = getSupabaseAdmin();
  // ignoreDuplicatesは既存トークンを置き換えない。Sandbox許可は運営が個別に設定する。
  const { error } = await admin.from("apple_purchase_accounts").upsert({ user_id: identity.userId, household_id: identity.householdId },
    { onConflict: "user_id,household_id", ignoreDuplicates: true });
  if (error) throw new Error("billing_unavailable");
  const { data, error: readError } = await admin.from("apple_purchase_accounts").select("token,sandbox_enabled")
    .eq("user_id", identity.userId).eq("household_id", identity.householdId).single();
  if (readError || !data) throw new Error("billing_unavailable");
  return data as { token: string; sandbox_enabled: boolean };
}

export async function persistAppleTransaction(transaction: ReturnType<typeof normalizeAppleTransaction>, identity?: { userId: string; householdId: string }) {
  const admin = getSupabaseAdmin();
  const { data: owner, error } = await admin.from("apple_purchase_accounts").select("user_id,household_id,sandbox_enabled,deleted_at")
    .eq("token", transaction.app_account_token).single();
  if (error || !owner) throw new Error("purchase_owner_mismatch");
  if (owner.deleted_at) {
    if (identity) throw new Error("purchase_owner_mismatch");
    return;
  }
  if (identity && (owner.user_id !== identity.userId || owner.household_id !== identity.householdId)) throw new Error("purchase_owner_mismatch");
  if (transaction.environment === "Sandbox" && !owner.sandbox_enabled) throw new Error("sandbox_not_allowed");
  const { error: saveError } = await admin.rpc("record_apple_transaction", { tx: transaction });
  if (saveError) throw new Error("billing_unavailable");
}
