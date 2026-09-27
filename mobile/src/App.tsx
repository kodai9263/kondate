import { useEffect, useState, type FormEvent } from "react";
import { isConfigured, supabase } from "./supabase";
import { loadShopping, saveShoppingChecked, type ShoppingItem, type ShoppingSnapshot } from "./shopping";

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ShoppingSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      if (!session) setSnapshot(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void loadShopping(accessToken).then((value) => {
      if (!cancelled) {
        setSnapshot(value);
        setError("");
      }
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "買い物リストを読み込めませんでした。");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accessToken]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.session) {
        setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
        return;
      }
      setAccessToken(data.session.access_token);
    } catch {
      setError("ログインできませんでした。接続を確認してください。");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function refresh() {
    if (!accessToken || loading || saving) return;
    setLoading(true);
    setError("");
    try {
      setSnapshot(await loadShopping(accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "買い物リストを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(item: ShoppingItem) {
    if (!accessToken || !snapshot || !online || saving) return;
    setSaving(true);
    setError("");
    try {
      setSnapshot(await saveShoppingChecked(accessToken, snapshot, item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。接続を確認してください。");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setAccessToken(null);
    setSnapshot(null);
    setError("");
  }

  const items = snapshot ? [
    ...snapshot.groups.flatMap((group) => group.items),
    ...snapshot.manualItems,
  ] : [];
  const remaining = items.filter((item) => !item.checked).length;

  return <div className="app-shell">
    <header className="top-bar">
      <div className="brand-mark" aria-hidden="true">食</div>
      <div>
        <p className="eyebrow">毎日の献立と買い物</p>
        <p className="brand-name">きょうのごはん</p>
      </div>
      {accessToken && <button className="text-button signout" type="button" onClick={() => void signOut()}>ログアウト</button>}
    </header>

    <main>
      {!isConfigured ? <section className="card setup-message" role="alert">
        <h1>接続設定を確認してください</h1>
        <p>アプリの認証先がまだ設定されていません。開発用の設定を確認してください。</p>
      </section> : !accessToken ? <section className="login-card">
        <span className="section-tag">買い物リストの技術検証</span>
        <h1>いつもの家族の<br />買い物リストを、スマホで。</h1>
        <p>Web版で使っているアカウントでログインしてください。</p>
        <form onSubmit={(event) => void signIn(event)}>
          <label htmlFor="email">メールアドレス</label>
          <input id="email" type="email" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">パスワード</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)} required />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "確認中…" : "ログイン"}</button>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
        <p className="hint">この検証版ではログイン状態を端末に保存しません。アプリを再起動した場合は再ログインが必要です。</p>
      </section> : <>
        <section className="page-heading">
          <span className="section-tag">SHOPPING LIST</span>
          <h1>買い物リスト</h1>
          <p>今週、買うものだけを確認。</p>
        </section>

        {snapshot && <section className="summary-card" aria-label="買い物の進み具合">
          <div>
            <p className="summary-label">買うもの</p>
            <p className="summary-count"><strong>{remaining}</strong><span>件</span></p>
          </div>
          <div className="summary-period">
            <p>{formatDate(snapshot.period.start)}〜{formatDate(snapshot.period.end)}</p>
            <span>{snapshot.period.mode === "today" ? "今日だけ" : snapshot.period.mode === "week" ? "7日間" : "期間指定"}</span>
          </div>
        </section>}

        {snapshot && <p className={online && !error ? "sync-status" : "sync-status stale"} role="status">
          {online && !error ? "● 保存済みリストを表示中" : "● 保存済みリストを表示中・最新の状態ではない可能性があります"}
          <small>取得：{formatTimestamp(snapshot.fetchedAt)}</small>
        </p>}

        {error && <p className="error-message" role="alert">{error}</p>}
        {!snapshot && !error && <p className="loading" role="status">買い物リストを読み込み中…</p>}
        {snapshot && <>
          <button className="refresh-button" type="button" onClick={() => void refresh()} disabled={loading || saving || !online}>
            {loading ? "更新中…" : "最新のリストを確認"}
          </button>
          {snapshot.groups.map((group) => <ShoppingGroup key={group.category} title={group.category} items={group.items}
            disabled={!online || saving} onToggle={toggleItem} />)}
          {snapshot.manualItems.length > 0 && <ShoppingGroup title="手動で追加したもの" items={snapshot.manualItems}
            disabled={!online || saving} onToggle={toggleItem} />}
          {items.length === 0 && <p className="empty">この期間に買うものはありません。</p>}
          {snapshot.warnings.length > 0 && <section className="warning-card">
            <h2>確認したいこと</h2>
            <ul>{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>}
          <p className="read-only-note">品物をタップするとチェックを保存します。圏外では変更できません。品物の追加や買い物完了はWeb版で行えます。</p>
        </>}
      </>}
    </main>
  </div>;
}

function ShoppingGroup({ title, items, disabled, onToggle }: {
  title: string; items: ShoppingItem[]; disabled: boolean; onToggle: (item: ShoppingItem) => Promise<void>;
}) {
  if (!items.length) return null;
  return <section className="shopping-group">
    <h2>{title}<span>{items.filter((item) => !item.checked).length}件</span></h2>
    <ul>{items.map((item) => <li key={`${item.source}:${item.category}:${item.name}:${item.position}`} className={item.checked ? "checked" : ""}>
      <button className="shopping-item-button" type="button" disabled={disabled} aria-pressed={item.checked}
        aria-label={`${item.label ?? item.name}を${item.checked ? "未購入に戻す" : "購入済みにする"}`}
        onClick={() => void onToggle(item)}>
        <span className="check-symbol" aria-hidden="true">{item.checked ? "✓" : ""}</span>
        <span>{item.label ?? item.name}{item.needsReview && <small>数量確認</small>}</span>
      </button>
    </li>)}</ul>
  </section>;
}

function formatDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "不明" : date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
