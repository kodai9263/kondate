import { describe, expect, it } from "vitest";
import { withShoppingItemChecked, type ShoppingSnapshot, type ShoppingItem } from "../mobile/src/shopping";

const auto: ShoppingItem = { source: "auto", category: "野菜", name: "にんじん", position: 0, checked: false };
const manual: ShoppingItem = { ...auto, source: "manual", id: "manual-1" };
const snapshot: ShoppingSnapshot = {
  version: 1, fetchedAt: "2026-10-04T00:00:00Z", householdId: "test-household",
  period: { storageWeekStart: "2026-10-04", start: "2026-10-04", end: "2026-10-10", mode: "week" },
  groups: [{ category: "野菜", items: [auto, { ...auto, category: "その他" }, { ...auto, position: 1 }] }],
  manualItems: [manual, { ...manual, id: "manual-2" }], hasDismissedSeasonings: false, warnings: [], latestCompletion: null,
};

describe("スマホの買い物チェック即時表示", () => {
  it("対象の自動品だけを反映し、保存失敗時に戻せる元データを保持する", () => {
    const next = withShoppingItemChecked(snapshot, auto, true);
    expect(next.groups[0].items.map((item) => item.checked)).toEqual([true, false, false]);
    expect(next.manualItems.map((item) => item.checked)).toEqual([false, false]);
    expect(snapshot.groups[0].items[0].checked).toBe(false);
    expect(next.fetchedAt).toBe(snapshot.fetchedAt);
  });
  it("手動品はIDで特定し同名の別品目を変更しない", () => {
    const next = withShoppingItemChecked(snapshot, manual, true);
    expect(next.manualItems.map((item) => item.checked)).toEqual([true, false]);
    expect(next.groups[0].items.every((item) => !item.checked)).toBe(true);
  });
  it("チェックの取り消しも即時に反映する", () => {
    const checked = withShoppingItemChecked(snapshot, auto, true);
    expect(withShoppingItemChecked(checked, auto, false).groups[0].items[0].checked).toBe(false);
    expect(checked.groups[0].items[0].checked).toBe(true);
  });
});
