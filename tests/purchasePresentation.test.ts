import { describe, expect, it } from "vitest";
import { productPresentation, transactionsForAccount } from "../mobile/src/purchasePresentation";
const product = { id: "app.kyounogohan.mobile.family.monthly", name: "月額", price: "$2.99", currency: "USD", storefront: "JPN", deviceRegion: "JP", testEnvironment: true };
describe("Appleの価格とアカウントの表示", () => {
  it("日本のテストで外貨が返ったら通常価格と明示してAppleで確認する", () => {
    expect(productPresentation(product)).toEqual({ price: "480円", reference: true, purchasable: true });
  });
  it("日本の本番で通貨が一致しなければ購入を止める", () => {
    expect(productPresentation({ ...product, testEnvironment: false }).purchasable).toBe(false);
  });
  it("日本円が取得できたらAppleの実価格を優先する", () => {
    expect(productPresentation({ ...product, price: "¥500", currency: "JPY" })).toEqual({ price: "¥500", reference: false, purchasable: true });
  });
  it("海外の本番価格を日本円に置き換えない", () => {
    expect(productPresentation({ ...product, storefront: "USA", testEnvironment: false }).price).toBe("$2.99");
  });
  it("再登録前や別人の取引を自動同期しない", () => {
    const transactions = [ { id: "1", signedTransaction: "a", appAccountToken: "OLD" }, { id: "2", signedTransaction: "b", appAccountToken: "NEW" }, { id: "3", signedTransaction: "c" } ];
    expect(transactionsForAccount(transactions, "new").map(t => t.id)).toEqual(["2", "3"]);
  });
});
