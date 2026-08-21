import Stripe from "stripe";

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(secretKey, {
    appInfo: {
      name: "kyou-no-gohan",
      version: "0.1.0",
    },
  });
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

type SubscriptionPeriodShape = {
  current_period_end?: number | null;
  items?: {
    data?: unknown[];
  };
};

export function getSubscriptionCurrentPeriodEnd(subscription: SubscriptionPeriodShape): string | null {
  const itemPeriodEnds = subscription.items?.data
    ?.map((item) => {
      if (!item || typeof item !== "object") return null;
      return (item as { current_period_end?: unknown }).current_period_end;
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0) ?? [];
  const timestamp = subscription.current_period_end ?? (itemPeriodEnds.length > 0 ? Math.max(...itemPeriodEnds) : null);

  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp * 1000).toISOString();
}
