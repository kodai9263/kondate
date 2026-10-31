import type { StoreProduct, StoreTransaction } from "./purchases";

const japanPrices: Record<string, string> = {
  "app.kyounogohan.mobile.family.monthly": "480円",
  "app.kyounogohan.mobile.family.yearly": "4,800円",
};
export function productPresentation(product: StoreProduct) {
  const japaneseStore = product.storefront === "JPN";
  const japaneseTest = product.testEnvironment === true && (japaneseStore || product.deviceRegion === "JP");
  if (product.currency && product.currency !== "JPY" && (japaneseStore || japaneseTest)) {
    // テスト環境の外貨メタデータを請求額として表示しない。日本の通常価格と明示する。
    const reference = japanPrices[product.id];
    return { price: reference ?? "", reference: true, purchasable: !!reference && product.testEnvironment === true };
  }
  return { price: product.price, reference: false, purchasable: true };
}
export function transactionsForAccount(transactions: StoreTransaction[], token: string) {
  // 古いアプリからの取引（識別子なし）はサーバーで照合する。
  return transactions.filter(transaction => !transaction.appAccountToken || transaction.appAccountToken.toLowerCase() === token.toLowerCase());
}
