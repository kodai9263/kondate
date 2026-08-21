import { NextResponse } from "next/server";
import { getBillingContext } from "@/lib/billing/context";
import { getAppUrl, getStripe } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  let context;
  try {
    context = await getBillingContext();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unauthenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("household_subscriptions")
    .select("stripe_customer_id")
    .eq("household_id", context.householdId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "subscription_lookup_failed" }, { status: 500 });
  }
  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${getAppUrl()}/account`,
  });

  return NextResponse.json({ url: session.url });
}
