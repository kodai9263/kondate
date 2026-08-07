import { describe, expect, it } from "vitest";
import { billingPlans, getPaidPlan } from "@/lib/billing/plans";

describe("billingPlans", () => {
  it("無料と月払いと年払いを提供する", () => {
    expect(billingPlans.map((plan) => plan.id)).toEqual(["free", "family_monthly", "family_yearly"]);
  });

  it("有料プランだけStripe Price環境変数を持つ", () => {
    expect(getPaidPlan("family_monthly").stripePriceEnv).toBe("STRIPE_PRICE_FAMILY_MONTHLY");
    expect(getPaidPlan("family_yearly").stripePriceEnv).toBe("STRIPE_PRICE_FAMILY_YEARLY");
  });
});
