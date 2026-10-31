import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

export const appleProducts = {
  "app.kyounogohan.mobile.family.monthly": "family_monthly",
  "app.kyounogohan.mobile.family.yearly": "family_yearly",
} as const;
export const appleBundleId = "app.kyounogohan.mobile";
export const appleAppId = 6826687098;

// この関数にはAppleの署名検証が完了した値だけを渡す。
export function normalizeAppleTransaction(value: JWSTransactionDecodedPayload, now = Date.now()) {
  if (value.bundleId !== appleBundleId || !value.productId || !Object.hasOwn(appleProducts, value.productId)
      || value.subscriptionGroupIdentifier !== "22530901"
      || value.type !== "Auto-Renewable Subscription" || value.inAppOwnershipType !== "PURCHASED"
      || !value.transactionId?.match(/^\d{1,64}$/) || !value.originalTransactionId?.match(/^\d{1,64}$/)
      || !value.appAccountToken?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      || !["Production", "Sandbox"].includes(value.environment ?? "")) throw new Error("invalid_transaction");
  const validDate = (date: unknown): date is number => typeof date === "number" && Number.isSafeInteger(date) && date > 0 && date < 8640000000000000;
  if (!validDate(value.expiresDate) || !validDate(value.purchaseDate) || !validDate(value.signedDate)
      || value.signedDate > now + 300_000 || value.purchaseDate > value.expiresDate
      || (value.revocationDate !== undefined && !validDate(value.revocationDate))) throw new Error("invalid_transaction");
  return {
    environment: value.environment as "Production" | "Sandbox",
    transaction_id: value.transactionId, original_transaction_id: value.originalTransactionId,
    app_account_token: value.appAccountToken.toLowerCase(), product_id: value.productId,
    plan_id: appleProducts[value.productId as keyof typeof appleProducts],
    purchased_at: new Date(value.purchaseDate).toISOString(), expires_at: new Date(value.expiresDate).toISOString(),
    signed_at: new Date(value.signedDate).toISOString(),
    revoked_at: value.revocationDate === undefined ? null : new Date(value.revocationDate).toISOString(),
    is_upgraded: value.isUpgraded === true,
  };
}
