import { describe, expect, it } from "vitest";
import { buildMobileShoppingSnapshot } from "@/lib/shopping/mobileSnapshot";
import { buildShoppingItemKey } from "@/lib/services/shoppingService";

describe("スマホ用の買い物保存内容", () => {
  it("購入済み・非表示・手動追加を区別し、調理材料の内部履歴を端末へ送らない", () => {
    const shopping = {
      householdId: "household-1", listId: "list-1",
      period: { start: "2026-09-27", end: "2026-10-03" },
      groups: [{ category: "野菜", items: [
        { category: "野菜", name: "k1", label: "玉ねぎ 2個", position: 0, needsReview: false, contributions: [{ key: "internal" }] },
        { category: "野菜", name: "k2", label: "にんじん 1本", position: 1, needsReview: false, contributions: [{ key: "private" }] },
      ] }],
      warnings: [], latestCompletion: null,
    };
    const saved = {
      checkedKeys: [buildShoppingItemKey("野菜", "k1")],
      dismissedKeys: [buildShoppingItemKey("野菜", "k2")],
      manualItems: [{ id: "manual-1", category: "その他", name: "牛乳", position: 2, checked: false, source: "manual" as const }],
    };
    const snapshot = buildMobileShoppingSnapshot(shopping as never, saved as never, "2026-09-27T00:00:00.000Z");
    expect(snapshot.groups[0].items).toEqual([{
      source: "auto", category: "野菜", name: "k1", label: "玉ねぎ 2個", position: 0,
      checked: true, needsReview: false,
    }]);
    expect(snapshot.manualItems).toEqual(saved.manualItems);
    expect(JSON.stringify(snapshot)).not.toContain("internal");
    expect(JSON.stringify(snapshot)).not.toContain("private");
    expect(snapshot.fetchedAt).toBe("2026-09-27T00:00:00.000Z");
  });
});
