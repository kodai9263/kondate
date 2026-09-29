/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { parseShoppingCache } from "../mobile/src/shoppingCacheParser";
import type { ShoppingSnapshot } from "../mobile/src/shopping";

const fetchedAt = "2026-09-29T03:00:00.000Z";
const savedAt = "2026-09-29T03:01:00.000Z";
const snapshot: ShoppingSnapshot = {
  version: 1, fetchedAt, householdId: "family-a",
  period: { storageWeekStart: "2026-09-28", start: "2026-09-29", end: "2026-10-05", mode: "week" },
  groups: [], manualItems: [], hasDismissedSeasonings: false, warnings: [], latestCompletion: null,
};
const raw = JSON.stringify({ version: 1, userId: "user-a", savedAt, snapshot });

describe("買い物リストの端末保存", () => {
  it("保存した本人だけが24時間以内に読める", () => {
    expect(parseShoppingCache(raw, "user-a", Date.parse(savedAt))).toEqual(snapshot);
    expect(parseShoppingCache(raw, "user-b", Date.parse(savedAt))).toBeNull();
    expect(parseShoppingCache(raw, "user-a", Date.parse(fetchedAt) + 24 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it("端末時計の巻き戻しと壊れたデータは表示しない", () => {
    expect(parseShoppingCache(raw, "user-a", Date.parse(fetchedAt))).toBeNull();
    expect(parseShoppingCache("{", "user-a", Date.parse(savedAt))).toBeNull();
    expect(parseShoppingCache(null, "user-a", Date.parse(savedAt))).toBeNull();
  });
});
