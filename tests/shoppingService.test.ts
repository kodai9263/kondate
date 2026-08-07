import { describe, expect, it } from "vitest";
import { menuData } from "@/lib/menuData";
import { buildShoppingItemsFromStaticList, getStaticShoppingForTemplateWeek, orderShoppingEntries } from "@/lib/services/shoppingService";

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
});
