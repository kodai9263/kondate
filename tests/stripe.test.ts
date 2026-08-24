import { describe, expect, it } from "vitest";
import { getSubscriptionCurrentPeriodEnd, isMissingStripeCustomerError } from "@/lib/billing/stripe";

describe("getSubscriptionCurrentPeriodEnd", () => {
  it("従来APIの購読本体にある終了日時を使う", () => {
    expect(getSubscriptionCurrentPeriodEnd({ current_period_end: 1_800_000_000 })).toBe("2027-01-15T08:00:00.000Z");
  });

  it("新APIの購読アイテムにある終了日時を使う", () => {
    expect(
      getSubscriptionCurrentPeriodEnd({
        items: {
          data: [{ current_period_end: 1_800_000_000 }],
        },
      }),
    ).toBe("2027-01-15T08:00:00.000Z");
  });

  it("有効な終了日時がない場合はnullを返す", () => {
    expect(getSubscriptionCurrentPeriodEnd({ items: { data: [{ current_period_end: null }] } })).toBeNull();
  });
});

describe("isMissingStripeCustomerError", () => {
  it("顧客が見つからないStripeエラーだけを判定する", () => {
    expect(isMissingStripeCustomerError({ code: "resource_missing", param: "customer" })).toBe(true);
    expect(isMissingStripeCustomerError({ code: "resource_missing", param: "price" })).toBe(false);
    expect(isMissingStripeCustomerError(new Error("network error"))).toBe(false);
  });
});
