import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ owner: { user_id: "owner", household_id: "home", sandbox_enabled: false, deleted_at: null as string | null }, rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: mock.owner, error: null }) }) }) }), rpc: mock.rpc,
}) }));
import { persistAppleTransaction } from "@/lib/billing/apple/service";
import { normalizeAppleTransaction } from "@/lib/billing/apple/transaction";
const transaction = normalizeAppleTransaction({
  bundleId: "app.kyounogohan.mobile", productId: "app.kyounogohan.mobile.family.monthly", subscriptionGroupIdentifier: "22530901",
  transactionId: "1234", originalTransactionId: "1234", appAccountToken: "10000000-0000-4000-8000-000000000021",
  environment: "Production", type: "Auto-Renewable Subscription", inAppOwnershipType: "PURCHASED",
  purchaseDate: Date.now()-1000, signedDate: Date.now(), expiresDate: Date.now()+3600000,
});
beforeEach(() => { mock.rpc.mockReset().mockResolvedValue({ error: null }); mock.owner.sandbox_enabled = false; mock.owner.deleted_at = null; });
describe("Apple購入の所有者と環境", () => {
  it.each([{ userId: "other", householdId: "home" }, { userId: "owner", householdId: "other" }])("別の本人または家族への復元を拒否", async identity => {
    await expect(persistAppleTransaction(transaction, identity)).rejects.toThrow("purchase_owner_mismatch");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("未許可のSandbox購入は本番の権利を付与しない", async () => {
    await expect(persistAppleTransaction({ ...transaction, environment: "Sandbox" })).rejects.toThrow("sandbox_not_allowed");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("許可したテスターのSandbox購入を記録する", async () => {
    mock.owner.sandbox_enabled = true;
    await persistAppleTransaction({ ...transaction, environment: "Sandbox" }, { userId: "owner", householdId: "home" });
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it("退会後の通知は成功扱いで破棄し、別アカウントへの復元も拒否する", async () => {
    mock.owner.deleted_at = new Date().toISOString();
    await expect(persistAppleTransaction(transaction)).resolves.toBeUndefined();
    await expect(persistAppleTransaction(transaction, { userId: "owner", householdId: "home" })).rejects.toThrow("purchase_owner_mismatch");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("保存失敗を成功と返さない", async () => {
    mock.rpc.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(persistAppleTransaction(transaction)).rejects.toThrow("billing_unavailable");
  });
});
