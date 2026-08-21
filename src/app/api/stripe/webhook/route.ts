import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await handleSubscriptionChanged(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const householdId = session.metadata?.household_id;
  if (!householdId || !session.customer || !session.subscription) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("household_subscriptions").upsert(
    {
      household_id: householdId,
      plan_id: session.metadata?.plan_id ?? "family_monthly",
      status: "checkout_completed",
      stripe_customer_id: String(session.customer),
      stripe_subscription_id: String(session.subscription),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" },
  );
  if (error) throw error;
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  const householdId = subscription.metadata?.household_id;
  if (!householdId) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("household_subscriptions").upsert(
    {
      household_id: householdId,
      plan_id: subscription.metadata?.plan_id ?? "family_monthly",
      status: subscription.status,
      stripe_customer_id: String(subscription.customer),
      stripe_subscription_id: subscription.id,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id" },
  );
  if (error) throw error;
}
