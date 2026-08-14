import { describe, expect, it } from "vitest";
import { canAccessHousehold, getEntitlements, isActiveSubscriptionStatus } from "@/lib/billing/entitlements";

describe("isActiveSubscriptionStatus", () => {
  it("activeやtrialingを有効扱いにする", () => {
    expect(isActiveSubscriptionStatus("active")).toBe(true);
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
  });

  it("期限切れは無効扱いにする", () => {
    expect(isActiveSubscriptionStatus("active", "2000-01-01T00:00:00.000Z")).toBe(false);
  });

  it("決済完了だけでは有料権限を付与しない", () => {
    expect(isActiveSubscriptionStatus("checkout_completed")).toBe(false);
  });

  it("無料状態では有料権限を付与しない", () => {
    expect(getEntitlements({ status: "free" }).family_sharing).toBe(false);
  });
});

describe("canAccessHousehold", () => {
  it("無料時は家族の最初の1人だけ利用できる", () => {
    expect(canAccessHousehold({ userId: "owner", firstMemberId: "owner", status: "free" })).toBe(true);
    expect(canAccessHousehold({ userId: "member", firstMemberId: "owner", status: "free" })).toBe(false);
  });

  it("契約中は家族全員が利用できる", () => {
    expect(canAccessHousehold({ userId: "member", firstMemberId: "owner", status: "active" })).toBe(true);
  });
});
