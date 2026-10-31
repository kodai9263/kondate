import { mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { applePurchaseIdentity, persistAppleTransaction, purchaseAccount } from "@/lib/billing/apple/service";
import { verifyAppleTransaction } from "@/lib/billing/apple/verification";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";

export const runtime = "nodejs";
export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (!origin) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: { ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
}
function failure(error: unknown, origin: string | null) {
  const code = error instanceof Error ? error.message : "billing_unavailable";
  const statuses: Record<string, number> = { unauthenticated: 401, registration_required: 403, household_unavailable: 403,
    purchase_owner_mismatch: 409, purchase_account_deleted: 409, sandbox_not_allowed: 403, verification_failed: 422, invalid_request: 400 };
  return mobileJsonError(code in statuses ? code : "billing_unavailable", statuses[code] ?? 503, origin);
}
export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const identity = await applePurchaseIdentity(request);
    const { data, error } = await identity.client.from("household_billing_access").select("status,current_period_end,provider")
      .eq("household_id", identity.householdId).single();
    if (error || !data) throw new Error("billing_unavailable");
    const account = await purchaseAccount(identity);
    return Response.json({ appAccountToken: account.token, sandboxEnabled: account.sandbox_enabled,
      active: isActiveSubscriptionStatus(data.status, data.current_period_end), provider: data.provider }, { headers: mobileResponseHeaders(origin) });
  } catch (error) { return failure(error, origin); }
}
export async function POST(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const identity = await applePurchaseIdentity(request);
    const text = await request.text();
    if (text.length > 24_000) throw new Error("invalid_request");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new Error("invalid_request"); }
    if (!body || typeof body !== "object" || !("signedTransaction" in body) || typeof body.signedTransaction !== "string"
      || body.signedTransaction.length > 20_000) throw new Error("invalid_request");
    const transaction = await verifyAppleTransaction(body.signedTransaction);
    await persistAppleTransaction(transaction, identity);
    const { data, error } = await identity.client.from("household_billing_access").select("status,current_period_end")
      .eq("household_id", identity.householdId).single();
    if (error || !data) throw new Error("billing_unavailable");
    return Response.json({ saved: true, transactionId: transaction.transaction_id,
      active: isActiveSubscriptionStatus(data.status, data.current_period_end) }, { headers: mobileResponseHeaders(origin) });
  } catch (error) { return failure(error, origin); }
}
