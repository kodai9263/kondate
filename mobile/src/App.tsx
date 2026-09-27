import { useEffect, useRef, useState, type FormEvent } from "react";
import { isConfigured, supabase } from "./supabase";
import { loadShopping, performShoppingAction, saveShoppingChecked, type ShoppingAction, type ShoppingItem, type ShoppingSnapshot } from "./shopping";
import { loadToday, type TodaySnapshot } from "./today";

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login");
  const [authNotice, setAuthNotice] = useState("");
  const authReady = useRef(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ShoppingSnapshot | null>(null);
  const [todaySnapshot, setTodaySnapshot] = useState<TodaySnapshot | null>(null);
  const [todayError, setTodayError] = useState("");
  const [activeTab, setActiveTab] = useState<"today" | "shopping">("today");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [notice, setNotice] = useState("");
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
      if (!session) {
        authReady.current = false;
        setAccessToken(null);
        setSnapshot(null);
        setTodaySnapshot(null);
      } else if (authReady.current) {
        setAccessToken(session.access_token);
      }
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

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void loadToday(accessToken).then((value) => {
      if (!cancelled) { setTodaySnapshot(value); setTodayError(""); }
    }).catch((cause: unknown) => {
      if (!cancelled) setTodayError(cause instanceof Error ? cause.message : "今日の献立を読み込めませんでした。");
    });
    return () => { cancelled = true; };
  }, [accessToken]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      if (authMode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${import.meta.env.VITE_API_BASE_URL}/auth/callback?next=/reset-password`,
        });
        if (resetError) { setError("メールを送信できませんでした。接続を確認してください。"); return; }
        setAuthNotice("再設定用のメールを送信しました。メールのリンクからWeb版で変更後、アプリでログインしてください。");
        return;
      }
      if (authMode === "signup") {
        if (!displayName.trim() || password.length < 8) {
          setError("表示名と8文字以上のパスワードを入力してください。");
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName.trim() },
            emailRedirectTo: `${import.meta.env.VITE_API_BASE_URL}/auth/callback?next=/app` },
        });
        if (signUpError) { setError("登録できませんでした。入力内容を確認してください。"); return; }
        if (!data.session) {
          setAuthNotice("確認メールを送信しました。メールのリンクを開いた後、アプリからログインしてください。");
          setAuthMode("login");
          return;
        }
        const { error: householdError } = await supabase.rpc("ensure_current_user_household");
        if (householdError) { await supabase.auth.signOut(); setError("家族の初期設定が完了しませんでした。もう一度ログインしてください。"); return; }
        authReady.current = true;
        setAccessToken(data.session.access_token);
        return;
      }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.session) {
        setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
        return;
      }
      const { error: householdError } = await supabase.rpc("ensure_current_user_household");
      if (householdError) { await supabase.auth.signOut(); setError("家族の情報を確認できませんでした。もう一度お試しください。"); return; }
      authReady.current = true;
      setAccessToken(data.session.access_token);
    } catch {
      setError("操作を完了できませんでした。接続を確認してください。");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function refresh() {
    if (!accessToken || loading || saving || actionBusy) return;
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
    if (!accessToken || !snapshot || !online || saving || actionBusy) return;
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

  async function runAction(action: ShoppingAction, successMessage: string) {
    if (!accessToken || !snapshot || !online || actionBusy || saving || loading) return;
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      setSnapshot(await performShoppingAction(accessToken, snapshot, action));
      setNotice(successMessage);
      if (action.action === "add") setNewItemName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。接続を確認してください。");
    } finally {
      setActionBusy(false);
    }
  }

  async function signOut() {
    authReady.current = false;
    await supabase?.auth.signOut();
    setAccessToken(null);
    setSnapshot(null);
    setTodaySnapshot(null);
    setError("");
    setNotice("");
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
        <span className="section-tag">きょうのごはん</span>
        <h1>{authMode === "signup" ? "無料で始める" : authMode === "reset" ? "パスワードを再設定" : <>今日の献立も、<br />買い物も、手のひらに。</>}</h1>
        <p>{authMode === "login" ? "Web版で使っているアカウントでもログインできます。" :
          authMode === "signup" ? "メールで確認後、家族の献立を使い始められます。" : "登録したメールアドレスを入力してください。"}</p>
        <form onSubmit={(event) => void submitAuth(event)}>
          {authMode === "signup" && <><label htmlFor="display-name">表示名</label>
            <input id="display-name" type="text" autoComplete="name" maxLength={40} value={displayName}
              onChange={(event) => setDisplayName(event.target.value)} required /></>}
          <label htmlFor="email">メールアドレス</label>
          <input id="email" type="email" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)} required />
          {authMode !== "reset" && <><label htmlFor="password">パスワード</label>
            <input id="password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              minLength={authMode === "signup" ? 8 : undefined} maxLength={128} value={password}
              onChange={(event) => setPassword(event.target.value)} required /></>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "確認中…" :
            authMode === "signup" ? "登録する" : authMode === "reset" ? "再設定メールを送る" : "ログイン"}</button>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
        {authNotice && <p className="notice-message" role="status">{authNotice}</p>}
        <div className="auth-links">
          {authMode !== "login" && <button type="button" onClick={() => { setAuthMode("login"); setError(""); setAuthNotice(""); }}>ログインへ戻る</button>}
          {authMode === "login" && <><button type="button" onClick={() => { setAuthMode("signup"); setError(""); setAuthNotice(""); }}>無料で始める</button>
            <button type="button" onClick={() => { setAuthMode("reset"); setError(""); setAuthNotice(""); }}>パスワードを忘れた</button></>}
        </div>
        <p className="hint">この検証版ではログイン状態を端末に保存しません。アプリを再起動した場合は再ログインが必要です。</p>
      </section> : <>
        <nav className="mobile-tabs" aria-label="主な画面">
          <button type="button" aria-current={activeTab === "today" ? "page" : undefined} onClick={() => setActiveTab("today")}>今日</button>
          <button type="button" aria-current={activeTab === "shopping" ? "page" : undefined} onClick={() => setActiveTab("shopping")}>買い物</button>
        </nav>
        {activeTab === "today" ? <section className="today-page">
          <div className="page-heading"><span className="section-tag">TODAY</span><h1>今日の献立</h1>
            <p>{todaySnapshot ? `${formatDate(todaySnapshot.today.date)}（${todaySnapshot.today.dow}）` : "今日の内容を確認中…"}</p></div>
          {todayError && <p className="error-message" role="alert">{todayError}</p>}
          {todaySnapshot && <>
            <section className="today-card"><p className="section-tag">朝ごはん</p>
              <h2>{todaySnapshot.today.breakfast?.name ?? "朝ごはんの予定はありません"}</h2>
              {todaySnapshot.today.breakfast?.tasks?.length ? <ul>{todaySnapshot.today.breakfast.tasks.map((task, index) => <li key={`${index}:${task}`}>{task}</li>)}</ul> : null}
            </section>
            <section className="today-card"><p className="section-tag">夜ごはん</p>
              <h2>{todaySnapshot.today.dinner.dinner}</h2>
              {todaySnapshot.today.dinner.side && <p className="today-side">副菜：{todaySnapshot.today.dinner.side}</p>}
              {todaySnapshot.today.dinner.totalMin !== undefined && <p className="today-time">目安 {todaySnapshot.today.dinner.totalMin}分</p>}
              <TodaySteps title="材料・調味料" steps={todaySnapshot.today.dinner.seasonings} />
              <TodaySteps title="作ること" steps={todaySnapshot.today.dinner.evening} />
              <TodaySteps title="副菜の手順" steps={todaySnapshot.today.dinner.sideSteps ?? []} />
            </section>
          </>}
          {!todaySnapshot && !todayError && <p className="loading" role="status">今日の献立を読み込み中…</p>}
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
        {notice && <p className="notice-message" role="status">{notice}</p>}
        {!snapshot && !error && <p className="loading" role="status">買い物リストを読み込み中…</p>}
        {snapshot && <>
          <section className="period-controls" aria-label="買い物の期間">
            <div className="period-buttons">
              <button type="button" aria-pressed={snapshot.period.mode === "today"} disabled={!online || actionBusy || saving}
                onClick={() => void runAction({ action: "period", mode: "today" }, "今日のリストに切り替えました。")}>今日</button>
              <button type="button" aria-pressed={snapshot.period.mode === "week"} disabled={!online || actionBusy || saving}
                onClick={() => void runAction({ action: "period", mode: "week" }, "7日間のリストに切り替えました。")}>7日間</button>
              <button type="button" aria-pressed={snapshot.period.mode === "custom"} disabled={!online || actionBusy || saving}
                onClick={() => { setCustomStart(snapshot.period.start); setCustomEnd(snapshot.period.end); }}>期間指定</button>
            </div>
            {customStart && <form className="custom-period" onSubmit={(event) => {
              event.preventDefault();
              void runAction({ action: "period", mode: "custom", start: customStart, end: customEnd }, "期間を変更しました。");
            }}>
              <label>開始日<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} required /></label>
              <label>終了日<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} required /></label>
              <button type="submit" disabled={!online || actionBusy || saving}>この期間を表示</button>
            </form>}
          </section>
          <button className="refresh-button" type="button" onClick={() => void refresh()} disabled={loading || saving || actionBusy || !online}>
            {loading ? "更新中…" : "最新のリストを確認"}
          </button>
          <form className="add-item" onSubmit={(event) => {
            event.preventDefault();
            const name = newItemName.trim();
            if (name) void runAction({ action: "add", name }, "買うものを追加しました。");
          }}>
            <label htmlFor="new-item">買うものを追加</label>
            <div><input id="new-item" value={newItemName} maxLength={200} placeholder="例：牛乳"
              onChange={(event) => setNewItemName(event.target.value)} />
              <button type="submit" disabled={!online || actionBusy || saving || !newItemName.trim()}>追加</button></div>
          </form>
          {items.some((item) => item.checked) && <button className="complete-button" type="button"
            disabled={!online || actionBusy || saving} onClick={() => void runAction({ action: "complete" }, "買い物の完了を保存しました。")}>チェックした品を買い物完了にする</button>}
          {snapshot.latestCompletion && <button className="undo-button" type="button" disabled={!online || actionBusy || saving}
            onClick={() => void runAction({ action: "undo", completionId: snapshot.latestCompletion!.id }, "直前の買い物完了を取り消しました。")}>直前の完了を取り消す</button>}
          {snapshot.groups.map((group) => <ShoppingGroup key={group.category} title={group.category} items={group.items}
            disabled={!online || saving || actionBusy} onToggle={toggleItem}
            onDismiss={group.category === "調味料(在庫確認)" ? (item) => runAction({ action: "dismiss", category: item.category, name: item.name, position: item.position }, "調味料をリストから外しました。") : undefined} />)}
          {snapshot.manualItems.length > 0 && <ShoppingGroup title="手動で追加したもの" items={snapshot.manualItems}
            disabled={!online || saving || actionBusy} onToggle={toggleItem}
            onDelete={(item) => item.id ? runAction({ action: "delete", id: item.id }, "買うものを削除しました。") : Promise.resolve()} />}
          {items.length === 0 && <p className="empty">この期間に買うものはありません。</p>}
          {snapshot.hasDismissedSeasonings && <button className="restore-button" type="button" disabled={!online || actionBusy || saving}
            onClick={() => void runAction({ action: "restore" }, "非表示にした調味料を戻しました。")}>非表示の調味料を戻す</button>}
          {snapshot.warnings.length > 0 && <section className="warning-card">
            <h2>確認したいこと</h2>
            <ul>{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>}
          <p className="read-only-note">品物をタップするとチェックを保存します。圏外では変更できません。</p>
        </>}
        </>}
      </>}
    </main>
  </div>;
}

function TodaySteps({ title, steps }: { title: string; steps: string[] }) {
  if (steps.length === 0) return null;
  return <div className="today-steps"><h3>{title}</h3><ol>{steps.map((step, index) => <li key={`${index}:${step}`}>{step}</li>)}</ol></div>;
}

function ShoppingGroup({ title, items, disabled, onToggle, onDelete, onDismiss }: {
  title: string; items: ShoppingItem[]; disabled: boolean; onToggle: (item: ShoppingItem) => Promise<void>;
  onDelete?: (item: ShoppingItem) => Promise<void>; onDismiss?: (item: ShoppingItem) => Promise<void>;
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
      {(onDelete || onDismiss) && <button className="item-delete" type="button" disabled={disabled}
        aria-label={`${item.label ?? item.name}をリストから外す`} onClick={() => void (onDelete ?? onDismiss)?.(item)}>削除</button>}
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
