import { describe, expect, it } from "vitest";
import { getEntitlements, isActiveSubscriptionStatus } from "@/lib/billing/entitlements";

describe("isActiveSubscriptionStatus", () => {
  it("activeやtrialingを有効扱いにする", () => {
    expect(isActiveSubscriptionStatus("active")).toBe(true);
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
  });

  it("期限切れは無効扱いにする", () => {
    expect(isActiveSubscriptionStatus("active", "2000-01-01T00:00:00.000Z")).toBe(false);
  });

  it("無料状態では有料権限を付与しない", () => {
    expect(getEntitlements({ status: "free" }).family_sharing).toBe(false);
  });
});
