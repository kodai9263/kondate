import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { deliverPurchase, FamilyStore, loadPurchaseContext, purchasesAvailable, type StoreProduct, type StoreTransaction } from "./purchases";

export function useApplePurchases(accessToken: string | null, userId: string | null, online: boolean, onChanged: () => void) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = useRef(false);
  const session = useRef({ accessToken, userId });
  const changed = useRef(onChanged);
  useLayoutEffect(() => { session.current = { accessToken, userId }; changed.current = onChanged; });

  useEffect(() => {
    if (!purchasesAvailable() || !accessToken || !userId || !online) return;
    let cancelled = false;
    const current = () => !cancelled && session.current.userId === userId;
    const sync = async () => {
      if (!current() || running.current) return;
      running.current = true;
      try {
        const { transactions } = await FamilyStore.transactions();
        for (const transaction of transactions) {
          if (!current()) return;
          await deliverPurchase(accessToken, transaction, current);
        }
        if (transactions.length && current()) changed.current();
      } catch (cause) {
        if (current()) setError(cause instanceof Error ? cause.message : "購入の確認を再試行してください。");
      } finally { running.current = false; }
    };
    void FamilyStore.products().then(value => { if (current()) setProducts(value.products); }).catch(() => {
      if (current()) setError("購入プランを取得できませんでした。通信を確認して、アプリを開き直してください。");
    });
    const listener = FamilyStore.addListener("transactionUpdated", () => { void sync(); });
    void sync();
    const visible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", visible); void listener.then(handle => handle.remove()); };
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
        const result = await FamilyStore.purchase({ productId, appAccountToken: context.appAccountToken });
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
    finally { running.current = false; setBusy(false); }
  }
  async function manage() {
    try { await FamilyStore.manage(); } catch { setError("契約管理を開けませんでした。iPhoneの設定からサブスクリプションをご確認ください。"); }
  }
  return { products, busy, message, error, act, manage };
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
    {!active && purchase.products.map(product => <button className="primary-button" style={{ marginTop: 12 }} key={product.id}
      type="button" disabled={disabled} onClick={() => { void purchase.act(product.id); }}>
      {product.id.endsWith("monthly") ? `月額 ${product.price}で購入（1か月）` : `年額 ${product.price}で購入（1年間）`}
    </button>)}
    {!active && !purchase.products.length && <p>購入プランを取得できるまでお待ちください。</p>}
    <p className="read-only-note">自動更新の定期購入です。支払いはApple Accountに請求されます。期間終了の24時間前までに解約しない限り更新されます。購入後の変更・解約はAppleの契約管理から行えます。</p>
    <p><a href="https://kondate-bay.vercel.app/terms" target="_blank" rel="noreferrer">利用規約</a> · <a href="https://kondate-bay.vercel.app/privacy" target="_blank" rel="noreferrer">プライバシーポリシー</a></p>
    <button className="purchase-secondary" type="button" disabled={disabled} onClick={() => { void purchase.act(); }}>購入を復元</button>{" "}
    <button className="purchase-secondary" type="button" disabled={purchase.busy || !online} onClick={() => { void purchase.manage(); }}>Appleの契約を管理</button>
    {purchase.busy && <p role="status">購入情報を確認しています…</p>}
    {purchase.message && <p className="notice-message" role="status">{purchase.message}</p>}
    {purchase.error && <p className="error-message" role="alert">{purchase.error}</p>}
  </section>;
}
