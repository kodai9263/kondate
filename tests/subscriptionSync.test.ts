import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { buildSubscriptionUpsert, resolveCheckoutSubscription } from "@/lib/billing/subscriptionSync";

function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_live_family",
    customer: "cus_live_family",
    status: "active",
    cancel_at_period_end: false,
    metadata: {
      household_id: "11111111-1111-4111-8111-111111111111",
      plan_id: "family_yearly",
    },
    items: { data: [{ current_period_end: 1_800_000_000 }] },
    ...overrides,
  } as Stripe.Subscription;
}

describe("resolveCheckoutSubscription", () => {
  it("Checkoutの購読IDから実際のSubscriptionを取得する", async () => {
    const activeSubscription = subscription();
    const retrieve = vi.fn().mockResolvedValue(activeSubscription);

    await expect(resolveCheckoutSubscription({ subscription: "sub_live_family" } as Stripe.Checkout.Session, retrieve)).resolves.toBe(activeSubscription);
    expect(retrieve).toHaveBeenCalledWith("sub_live_family");
  });

  it("Subscriptionが展開済みなら再取得しない", async () => {
    const activeSubscription = subscription();
    const retrieve = vi.fn();

    await expect(resolveCheckoutSubscription({ subscription: activeSubscription } as Stripe.Checkout.Session, retrieve)).resolves.toBe(activeSubscription);
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe("buildSubscriptionUpsert", () => {
  it("Stripeの有効状態と契約情報をそのまま保存する", () => {
    expect(buildSubscriptionUpsert(subscription())).toMatchObject({
      household_id: "11111111-1111-4111-8111-111111111111",
      plan_id: "family_yearly",
      status: "active",
      stripe_customer_id: "cus_live_family",
      stripe_subscription_id: "sub_live_family",
      current_period_end: "2027-01-15T08:00:00.000Z",
      cancel_at_period_end: false,
    });
  });

  it("家族IDがないイベントは保存しない", () => {
    expect(buildSubscriptionUpsert(subscription({ metadata: {} }))).toBeNull();
  });
});
