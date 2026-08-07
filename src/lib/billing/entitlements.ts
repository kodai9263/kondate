export const premiumFeatureKeys = [
  "family_sharing",
  "shopping_sync",
  "persisted_task_checks",
  "seasonal_templates",
  "child_feedback",
  "unlimited_nutrition_plans",
  "unlimited_custom_recipes",
] as const;

export type PremiumFeatureKey = (typeof premiumFeatureKeys)[number];

const activeStatuses = new Set(["active", "trialing", "checkout_completed"]);

export function isActiveSubscriptionStatus(status: string, currentPeriodEnd?: string | null): boolean {
  if (!activeStatuses.has(status)) return false;
  if (!currentPeriodEnd) return true;
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

export function getEntitlements(input: { status: string; currentPeriodEnd?: string | null }): Record<PremiumFeatureKey, boolean> {
  const active = isActiveSubscriptionStatus(input.status, input.currentPeriodEnd);
  return premiumFeatureKeys.reduce(
    (acc, key) => {
      acc[key] = active;
      return acc;
    },
    {} as Record<PremiumFeatureKey, boolean>,
  );
}
