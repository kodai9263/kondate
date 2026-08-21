import { NextResponse } from "next/server";
import { z } from "zod";
import { getBillingContext } from "@/lib/billing/context";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getPaidPlan } from "@/lib/billing/plans";
import { getAppUrl, getStripe } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  planId: z.enum(["family_monthly", "family_yearly"]),
});

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let context;
  try {
    context = await getBillingContext();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthenticated" }, { status: 401 });
  }

  const plan = getPaidPlan(parsed.data.planId);
  const priceId = process.env[plan.stripePriceEnv!];
  if (!priceId) {
    return NextResponse.json({ error: "stripe_price_not_configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existingSubscription } = await supabase
    .from("household_subscriptions")
    .select("stripe_customer_id,status,current_period_end")
    .eq("household_id", context.householdId)
    .maybeSingle();
  if (existingSubscription && isActiveSubscriptionStatus(existingSubscription.status, existingSubscription.current_period_end)) {
    return NextResponse.json({ error: "subscription_already_active" }, { status: 409 });
  }

  const appUrl = getAppUrl();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existingSubscription?.stripe_customer_id ?? undefined,
    customer_email: existingSubscription?.stripe_customer_id ? undefined : context.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: context.householdId,
    metadata: {
      household_id: context.householdId,
      plan_id: parsed.data.planId,
      user_id: context.userId,
    },
    subscription_data: {
      metadata: {
        household_id: context.householdId,
        plan_id: parsed.data.planId,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
