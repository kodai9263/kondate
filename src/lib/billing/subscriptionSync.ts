import type Stripe from "stripe";
import { getSubscriptionCurrentPeriodEnd } from "@/lib/billing/stripe";

export async function resolveCheckoutSubscription(
  session: Stripe.Checkout.Session,
  retrieve: (subscriptionId: string) => Promise<Stripe.Subscription>,
): Promise<Stripe.Subscription | null> {
  if (!session.subscription) return null;
  return typeof session.subscription === "string"
    ? retrieve(session.subscription)
    : session.subscription;
}

export function buildSubscriptionUpsert(subscription: Stripe.Subscription) {
  const householdId = subscription.metadata?.household_id;
  if (!householdId) return null;

  return {
    household_id: householdId,
    plan_id: subscription.metadata?.plan_id ?? "family_monthly",
    status: subscription.status,
    stripe_customer_id: String(subscription.customer),
    stripe_subscription_id: subscription.id,
    current_period_end: getSubscriptionCurrentPeriodEnd(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
}
