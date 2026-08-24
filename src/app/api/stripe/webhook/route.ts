import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { buildSubscriptionUpsert, resolveCheckoutSubscription } from "@/lib/billing/subscriptionSync";
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
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  const subscription = await resolveCheckoutSubscription(session, (subscriptionId) =>
    stripe.subscriptions.retrieve(subscriptionId),
  );
  if (!subscription) return;
  await handleSubscriptionChanged(subscription);
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  const record = buildSubscriptionUpsert(subscription);
  if (!record) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("household_subscriptions").upsert(
    record,
    { onConflict: "household_id" },
  );
  if (error) throw error;
}
