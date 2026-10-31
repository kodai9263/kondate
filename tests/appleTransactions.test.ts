import { describe, expect, it } from "vitest";
import { normalizeAppleTransaction } from "@/lib/billing/apple/transaction";
import { verifyAppleTransaction } from "@/lib/billing/apple/verification";

const now = Date.now();
const valid = {
  bundleId: "app.kyounogohan.mobile", productId: "app.kyounogohan.mobile.family.monthly",
  subscriptionGroupIdentifier: "22530901", type: "Auto-Renewable Subscription", inAppOwnershipType: "PURCHASED",
  transactionId: "123456", originalTransactionId: "123456", appAccountToken: "10000000-0000-4000-8000-000000000021",
  environment: "Production", purchaseDate: now - 1000, expiresDate: now + 3600000, signedDate: now,
};
describe("Appleの検証済み購入情報", () => {
  it("商品を家族プランに対応付ける", () => {
    expect(normalizeAppleTransaction(valid, now)).toMatchObject({ plan_id: "family_monthly", revoked_at: null, is_upgraded: false });
    expect(normalizeAppleTransaction({ ...valid, productId: "app.kyounogohan.mobile.family.yearly" }, now).plan_id).toBe("family_yearly");
  });
  it.each([
    { bundleId: "other.app" }, { productId: "unexpected" }, { productId: "toString" }, { subscriptionGroupIdentifier: "other" },
    { appAccountToken: undefined }, { inAppOwnershipType: "FAMILY_SHARED" }, { environment: "Xcode" },
    { expiresDate: undefined }, { signedDate: now + 600000 }, { expiresDate: Number.NaN },
  ])("別アプリ・未知商品・所有者不明・不正な日時を拒否する: %j", patch => {
    expect(() => normalizeAppleTransaction({ ...valid, ...patch }, now)).toThrow();
  });
  it("期限切れと返金は削除せず保存用の状態に残す", () => {
    expect(normalizeAppleTransaction({ ...valid, expiresDate: now - 1, revocationDate: now }, now).revoked_at).toBe(new Date(now).toISOString());
  });
  it("署名のない購入情報を受け付けない", async () => {
    await expect(verifyAppleTransaction(`e30.${Buffer.from(JSON.stringify(valid)).toString("base64url")}.fake`)).rejects.toThrow("verification_failed");
  });
});
