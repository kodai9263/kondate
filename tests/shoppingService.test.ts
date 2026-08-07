import { describe, expect, it } from "vitest";
import { menuData } from "@/lib/menuData";
import { buildShoppingItemKey, buildShoppingItemsFromStaticList, getCurrentShoppingWeekIndex, getShoppingCycle, getStaticShoppingForTemplateWeek, orderShoppingEntries } from "@/lib/services/shoppingService";

describe("shoppingService", () => {
  it("週別の静的買い物リストを取得する", () => {
    const shopping = getStaticShoppingForTemplateWeek(menuData, 0);
    expect(shopping["肉"]).toContain("合いびき肉 500g");
  });

  it("調味料カテゴリを末尾側に並べる", () => {
    const entries = orderShoppingEntries(getStaticShoppingForTemplateWeek(menuData, 0));
    expect(entries[0][0]).toBe("肉");
    expect(entries.at(-1)?.[0]).toBe("調味料(在庫確認)");
  });

  it("再生成時に手動追加を保持する", () => {
    const items = buildShoppingItemsFromStaticList(getStaticShoppingForTemplateWeek(menuData, 0), [
      { category: "手動", name: "牛乳 追加", source: "manual", checked: true, position: 0 },
    ]);

    expect(items.some((item) => item.name === "牛乳 追加" && item.checked)).toBe(true);
  });

  it("現在日から4週間ローテーションの対象週を求める", () => {
    expect(getCurrentShoppingWeekIndex(menuData, new Date("2026-08-08T12:00:00+09:00"))).toBe(1);
    expect(getCurrentShoppingWeekIndex(menuData, new Date("2026-08-23T12:00:00+09:00"))).toBe(0);
  });

  it("設定した買い物曜日に翌週分へ切り替える", () => {
    expect(getShoppingCycle(menuData, 6, new Date("2026-08-07T12:00:00+09:00"))).toEqual({ weekIndex: 1, weekStart: "2026-08-02" });
    expect(getShoppingCycle(menuData, 6, new Date("2026-08-08T00:00:00+09:00"))).toEqual({ weekIndex: 2, weekStart: "2026-08-09" });
    expect(getShoppingCycle(menuData, 0, new Date("2026-08-09T00:00:00+09:00"))).toEqual({ weekIndex: 2, weekStart: "2026-08-09" });
  });

  it("カテゴリと元の品名から保存用の品目キーを作る", () => {
    expect(buildShoppingItemKey("肉", "豚こま 900g")).toBe("肉\u001f豚こま 900g");
  });
});
