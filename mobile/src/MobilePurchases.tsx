import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { deliverPurchase, PurchaseError, FamilyStore, loadPurchaseContext, purchasesAvailable, type StoreProduct, type StoreTransaction } from "./purchases";
import { productPresentation, transactionsForAccount } from "./purchasePresentation";

export function useApplePurchases(accessToken: string | null, userId: string | null, online: boolean, onChanged: () => void) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = useRef(false);
  const refreshPricesRef = useRef<() => Promise<void>>(async () => {});
  const session = useRef({ accessToken, userId });
  const changed = useRef(onChanged);
  useLayoutEffect(() => { session.current = { accessToken, userId }; changed.current = onChanged; });

  useEffect(() => {
    if (!purchasesAvailable() || !accessToken || !userId || !online) return;
    let cancelled = false;
    const current = () => !cancelled && session.current.userId === userId;
    queueMicrotask(() => { if (current()) { setError(""); setMessage(""); } });
    const sync = async () => {
      if (!current() || running.current) return;
      running.current = true;
      try {
        const [context, result] = await Promise.all([loadPurchaseContext(accessToken), FamilyStore.transactions()]);
        const transactions = transactionsForAccount(result.transactions, context.appAccountToken);
        for (const transaction of transactions) {
          if (!current()) return;
          try { await deliverPurchase(accessToken, transaction, current); }
          catch (cause) {
            if (cause instanceof PurchaseError && ["purchase_owner_mismatch", "purchase_account_deleted"].includes(cause.code)) continue;
            throw cause;
          }
        }
        if (transactions.length && current()) changed.current();
      } catch (cause) {
        if (current()) setError(cause instanceof Error ? cause.message : "購入の確認を再試行してください。");
      } finally { running.current = false; }
    };
    let priceRequest = 0;
    const refreshPrices = async () => {
      const request = ++priceRequest;
      setProducts([]);
      try {
        const value = await FamilyStore.products();
        if (current() && request === priceRequest) setProducts(value.products);
      } catch {
        if (current() && request === priceRequest) setError("購入プランを取得できませんでした。通信を確認して、アプリを開き直してください。");
      }
    };
    refreshPricesRef.current = refreshPrices;
    void refreshPrices();
    const listener = FamilyStore.addListener("transactionUpdated", () => { void sync(); });
    const storefrontListener = FamilyStore.addListener("storefrontUpdated", () => { void refreshPrices(); });
    void sync();
    const visible = () => { if (document.visibilityState === "visible") { void refreshPrices(); void sync(); } };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      refreshPricesRef.current = async () => {};
      document.removeEventListener("visibilitychange", visible);
      void listener.then(handle => handle.remove());
      void storefrontListener.then(handle => handle.remove());
    };
  }, [accessToken, userId, online]);

  async function act(productId?: string) {
    if (!accessToken || !userId || !online || running.current) return;
    const owner = userId;
    const current = () => session.current.userId === owner && !!session.current.accessToken;
    running.current = true; setBusy(true); setMessage(""); setError("");
    try {
      const context = await loadPurchaseContext(accessToken);
      if (!current()) return;
      let transactions: StoreTransaction[];
      if (productId) {
        if (context.active) { setMessage("家族プランをすでに利用中です。契約内容は契約元で管理してください。"); changed.current(); return; }
        const displayed = products.find(product => product.id === productId);
        if (!displayed || !productPresentation(displayed).purchasable) { setError("最新の価格を確認してから、もう一度お試しください。"); return; }
        const result = await FamilyStore.purchase({ productId, appAccountToken: context.appAccountToken, expectedPrice: displayed.price });
        if (!current()) return;
        if (result.status === "cancelled") { setMessage("購入をキャンセルしました。"); return; }
        if (result.status === "pending") { setMessage("購入の承認待ちです。承認後に自動で確認します。"); return; }
        if (!("transaction" in result)) return;
        transactions = [result.transaction];
      } else { transactions = (await FamilyStore.restore()).transactions; }
      if (!current()) return;
      let active = false;
      for (const transaction of transactions) {
        active = await deliverPurchase(accessToken, transaction, current) || active;
      }
      if (current()) {
        setMessage(active ? "家族プランを利用できます。" : "現在有効な購入は見つかりませんでした。購入時のApple Accountとアプリのアカウントをご確認ください。");
        changed.current();
      }
    } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : "購入・復元を完了できませんでした。"); }
    finally {
      if (current()) await refreshPricesRef.current();
      running.current = false; setBusy(false);
    }
  }
  async function manage() {
    try { await FamilyStore.manage(); } catch { setError("契約管理を開けませんでした。iPhoneの設定からサブスクリプションをご確認ください。"); }
  }
  return { products, busy, message, error, act, manage, refreshPrices: () => refreshPricesRef.current() };
}

export function ApplePurchaseCard({ purchase, active, anonymous, online }: {
  purchase: ReturnType<typeof useApplePurchases>; active: boolean; anonymous: boolean; online: boolean;
}) {
  if (!purchasesAvailable()) return null;
  const disabled = purchase.busy || !online || anonymous;
  return <section className="account-card">
    <h2>家族プラン</h2>
    <p>週間・月間の献立と買い物リストを継続利用でき、家族と共有できます。</p>
    {anonymous && <p>購入・復元にはアカウント登録が必要です。</p>}
    {!active && purchase.products.map(product => {
      const display = productPresentation(product);
      const period = product.id.endsWith("monthly") ? "月額" : "年額";
      return <div key={product.id} style={{ marginTop: 16 }}>
        {display.reference && <p><strong>{period} {display.price}</strong><br /><small>日本での通常価格（税込）</small></p>}
        <button className="primary-button" type="button" disabled={disabled || !display.purchasable} onClick={() => { void purchase.act(product.id); }}>
          {display.reference ? `${period}プランをAppleで確認` : `${period} ${display.price}で購入（${period === "月額" ? "1か月" : "1年間"}）`}
        </button>
      </div>;
    })}
    {!active && purchase.products.some(product => productPresentation(product).reference) && <p className="read-only-note">Appleの価格情報に通貨の違いがあるため、日本の通常価格を案内しています。購入前にAppleの確認画面で金額をご確認ください。</p>}
    {!active && !purchase.products.length && <p>Appleの価格を確認しています。表示されない場合は下のボタンで再確認してください。</p>}
    {!active && <button className="purchase-secondary" type="button" disabled={disabled} onClick={() => { void purchase.refreshPrices(); }}>価格を再確認</button>}
    <p className="read-only-note">自動更新の定期購入です。支払いはApple Accountに請求されます。期間終了の24時間前までに解約しない限り更新されます。購入後の変更・解約はAppleの契約管理から行えます。</p>
    <p><a href="https://kondate-bay.vercel.app/terms" target="_blank" rel="noreferrer">利用規約</a> · <a href="https://kondate-bay.vercel.app/privacy" target="_blank" rel="noreferrer">プライバシーポリシー</a></p>
    <button className="purchase-secondary" type="button" disabled={disabled} onClick={() => { void purchase.act(); }}>購入を復元</button>{" "}
    <button className="purchase-secondary" type="button" disabled={purchase.busy || !online} onClick={() => { void purchase.manage(); }}>Appleの契約を管理</button>
    {purchase.busy && <p role="status">購入情報を確認しています…</p>}
    {purchase.message && <p className="notice-message" role="status">{purchase.message}</p>}
    {purchase.error && <p className="error-message" role="alert">{purchase.error}</p>}
  </section>;
}
