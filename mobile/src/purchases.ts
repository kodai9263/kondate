import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type StoreTransaction = { id: string; signedTransaction: string };
export type StoreProduct = { id: string; name: string; price: string };
export interface FamilyStorePlugin {
  products(): Promise<{ products: StoreProduct[] }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<{ status: "purchased"; transaction: StoreTransaction } | { status: "pending" | "cancelled" }>;
  transactions(): Promise<{ transactions: StoreTransaction[] }>;
  restore(): Promise<{ transactions: StoreTransaction[] }>;
  finish(options: { transactionId: string }): Promise<void>;
  manage(): Promise<void>;
  addListener(event: "transactionUpdated", listener: () => void): Promise<PluginListenerHandle>;
}
export const FamilyStore = registerPlugin<FamilyStorePlugin>("FamilyStore");
export const purchasesAvailable = () => Capacitor.getPlatform() === "ios";
export type PurchaseContext = { appAccountToken: string; sandboxEnabled: boolean; active: boolean; provider: "apple" | "stripe" | "none" };
const messages: Record<string, string> = {
  unauthenticated: "ログインの有効期限が切れました。もう一度ログインしてください。",
  registration_required: "購入・復元にはアカウント登録が必要です。",
  purchase_owner_mismatch: "この購入は別のアカウントまたは家族に登録されています。購入時のアカウントでログインしてください。",
  sandbox_not_allowed: "このアカウントではテスト購入がまだ有効になっていません。",
  verification_failed: "Appleの購入情報を確認できませんでした。購入を復元して再度お試しください。",
};
async function api(accessToken: string, signedTransaction?: string) {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${base}/api/mobile/v1/billing/apple`, {
    method: signedTransaction ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}`, ...(signedTransaction ? { "Content-Type": "application/json" } : {}) },
    ...(signedTransaction ? { body: JSON.stringify({ signedTransaction }) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(messages[body.error] ?? "契約を確認できませんでした。通信を戻して購入を復元してください。");
  return body;
}
export async function loadPurchaseContext(accessToken: string): Promise<PurchaseContext> {
  const body = await api(accessToken);
  if (typeof body.appAccountToken !== "string" || typeof body.active !== "boolean" || typeof body.sandboxEnabled !== "boolean"
    || !["apple", "stripe", "none"].includes(body.provider)) throw new Error("契約情報を確認できませんでした。");
  return body;
}
export async function deliverPurchase(accessToken: string, transaction: StoreTransaction, current: () => boolean,
  store: Pick<FamilyStorePlugin, "finish"> = FamilyStore): Promise<boolean> {
  if (!current()) throw new Error("アカウントが変わりました。購入時のアカウントで復元してください。");
  const body = await api(accessToken, transaction.signedTransaction);
  if (body.saved !== true || body.transactionId !== transaction.id || typeof body.active !== "boolean") throw new Error("購入の保存結果を確認できませんでした。");
  // サーバーへ保存した取引だけを完了する。失敗した取引は次回起動で再送する。
  await store.finish({ transactionId: transaction.id });
  return body.active;
}
