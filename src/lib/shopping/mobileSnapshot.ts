import { buildShoppingItemKey } from "@/lib/services/shoppingService";
import type { getPlannedShopping, getSavedShoppingState } from "./server";

type Shopping = Awaited<ReturnType<typeof getPlannedShopping>>;
type Saved = Awaited<ReturnType<typeof getSavedShoppingState>>;

export function buildMobileShoppingSnapshot(shopping: Shopping, saved: Saved, fetchedAt = new Date().toISOString()) {
  const checked = new Set(saved.checkedKeys);
  const dismissed = new Set(saved.dismissedKeys);
  return {
    version: 1 as const,
    fetchedAt,
    householdId: shopping.householdId,
    listId: shopping.listId ?? null,
    period: shopping.period,
    groups: shopping.groups.map((group) => ({
      category: group.category,
      items: group.items.filter((item) => !dismissed.has(buildShoppingItemKey(item.category, item.name)))
        .map((item) => ({
          source: "auto" as const,
          category: item.category,
          name: item.name,
          label: item.label,
          position: item.position,
          checked: checked.has(buildShoppingItemKey(item.category, item.name)),
          needsReview: item.needsReview,
        })),
    })).filter((group) => group.items.length > 0),
    manualItems: saved.manualItems,
    hasDismissedSeasonings: saved.dismissedKeys.length > 0,
    warnings: shopping.warnings,
    latestCompletion: shopping.latestCompletion,
  };
}

export type MobileShoppingSnapshot = ReturnType<typeof buildMobileShoppingSnapshot>;
