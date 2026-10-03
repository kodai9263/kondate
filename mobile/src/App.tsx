import { useEffect, useRef, useState, type FormEvent } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isConfigured, supabase } from "./supabase";
import { clearReminderSettings, defaultReminderSettings, loadReminderSettings, remindersAvailable,
  renewReminderSchedules, saveReminderSettings, type Reminder, type ReminderSettings } from "./reminders";
import { loadShopping, performShoppingAction, saveShoppingChecked, withShoppingItemChecked, type ShoppingAction, type ShoppingItem, type ShoppingSnapshot } from "./shopping";
import { ShoppingAccessError, ShoppingSessionError } from "./shopping";
import { clearShoppingCache, loadShoppingCache, saveShoppingCache } from "./shoppingCache";
import { loadToday, type TodaySnapshot } from "./today";

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login");
  const [authNotice, setAuthNotice] = useState("");
  const authReady = useRef(false);
  const cacheGeneration = useRef(0);
  const cacheWrite = useRef<Promise<void>>(Promise.resolve());
  const currentUserId = useRef<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cachedOnly, setCachedOnly] = useState(false);
  const [snapshot, setSnapshot] = useState<ShoppingSnapshot | null>(null);
  const [todaySnapshot, setTodaySnapshot] = useState<TodaySnapshot | null>(null);
  const [todayError, setTodayError] = useState("");
  const [activeTab, setActiveTab] = useState<"today" | "shopping" | "settings">("today");
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
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const [restoringSession, setRestoringSession] = useState(isConfigured && Capacitor.isNativePlatform());
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(defaultReminderSettings);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

  function acceptShopping(value: ShoppingSnapshot, ownerId: string) {
    setSnapshot(value);
    setCachedOnly(false);
    const generation = cacheGeneration.current;
    cacheWrite.current = cacheWrite.current.catch(() => {}).then(async () => {
      if (generation === cacheGeneration.current) await saveShoppingCache(ownerId, value);
    });
    void cacheWrite.current.catch(() => setNotice("端末への保存ができませんでした。圏外での閲覧は利用できない可能性があります。"));
  }

  async function discardShoppingCache() {
    cacheGeneration.current += 1;
    await cacheWrite.current.catch(() => {});
    await clearShoppingCache();
  }

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
    if (!accessToken) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        if (navigator.onLine) setRefreshEpoch((value) => value + 1);
        void renewReminderSchedules().catch(() => setReminderMessage("通知を確認できませんでした。設定を開いて確認してください。"));
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !remindersAvailable()) return;
    let cancelled = false;
    let listener: PluginListenerHandle | undefined;
    void loadReminderSettings().then((settings) => {
      if (!cancelled) setReminderSettings(settings);
      return renewReminderSchedules();
    }).catch(() => {
      if (!cancelled) setReminderMessage("通知設定を読み込めませんでした。");
    });
    void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      const tab = notification.extra?.tab;
      if (tab === "today" || tab === "shopping") setActiveTab(tab);
    }).then((handle) => {
      if (cancelled) void handle.remove();
      else listener = handle;
    });
    return () => { cancelled = true; void listener?.remove(); };
  }, [accessToken]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let restoreGeneration = 0;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session) {
          const generation = restoreGeneration;
          if (!navigator.onLine) {
            authReady.current = true;
            currentUserId.current = session.user.id;
            setUserId(session.user.id);
            setAccessToken(session.access_token);
            setRestoringSession(false);
            return;
          }
          // 認証イベント内で別のSupabase操作を待つと停止するため、次のタスクで確認する。
          window.setTimeout(() => {
            if (!active || generation !== restoreGeneration) return;
            void Promise.resolve(client.rpc("ensure_current_user_household")).then(({ error: householdError }) => {
              if (!active || generation !== restoreGeneration) return;
              if (householdError) {
                setError("家族の情報を確認できませんでした。接続を確認して再度お試しください。");
                setRestoringSession(false);
                return;
              }
              authReady.current = true;
              currentUserId.current = session.user.id;
              setUserId(session.user.id);
              setAccessToken(session.access_token);
              setRestoringSession(false);
            }).catch(() => {
              if (active && generation === restoreGeneration) {
                setError("接続できませんでした。通信を確認してください。");
                setRestoringSession(false);
              }
            });
          }, 0);
        } else setRestoringSession(false);
        return;
      }
      restoreGeneration += 1;
      if (!session) {
        authReady.current = false;
        currentUserId.current = null;
        setAccessToken(null);
        setUserId(null);
        setSnapshot(null);
        setTodaySnapshot(null);
        if (event === "SIGNED_OUT") void discardShoppingCache().catch(() => {});
      } else if (authReady.current) {
        if (currentUserId.current && currentUserId.current !== session.user.id) setSnapshot(null);
        currentUserId.current = session.user.id;
        setUserId(session.user.id);
        setAccessToken(session.access_token);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!accessToken || !userId) return;
    let cancelled = false;
    if (!online) {
      void loadShoppingCache(userId).then((value) => {
        if (!cancelled) {
          setLoading(false);
          setSnapshot(value);
          setCachedOnly(true);
          setError(value ? "" : "保存済みのリストがありません。接続してリストを保存してください。");
        }
      }).catch(() => {
        if (!cancelled) { setLoading(false); setError("保存済みのリストを読み込めませんでした。"); }
      });
      return () => { cancelled = true; };
    }
    void loadShopping(accessToken).then((value) => {
      if (!cancelled) {
        acceptShopping(value, userId);
        setError("");
      }
    }).catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ShoppingAccessError || cause instanceof ShoppingSessionError) {
        setSnapshot(null);
        setCachedOnly(false);
        void discardShoppingCache().catch(() => {});
        setError(displayError(cause, "買い物リストを読み込めませんでした。"));
      } else {
        void loadShoppingCache(userId).then((value) => {
          if (cancelled) return;
          setSnapshot(value);
          setCachedOnly(true);
          setError(value ? "" : "保存済みのリストがありません。接続してリストを保存してください。");
        }).catch(() => {
          if (!cancelled) setError(displayError(cause, "買い物リストを読み込めませんでした。"));
        });
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accessToken, userId, online, refreshEpoch]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void loadToday(accessToken).then((value) => {
      if (!cancelled) { setTodaySnapshot(value); setTodayError(""); }
    }).catch((cause: unknown) => {
      if (!cancelled) setTodayError(displayError(cause, "今日の献立を読み込めませんでした。"));
    });
    return () => { cancelled = true; };
  }, [accessToken, refreshEpoch]);

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
        currentUserId.current = data.session.user.id;
        setUserId(data.session.user.id);
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
      currentUserId.current = data.session.user.id;
      setUserId(data.session.user.id);
      setAccessToken(data.session.access_token);
    } catch {
      setError("操作を完了できませんでした。接続を確認してください。");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function refresh() {
    if (!accessToken || !userId || loading || saving || actionBusy || !online) return;
    setLoading(true);
    setError("");
    try {
      acceptShopping(await loadShopping(accessToken), userId);
    } catch (cause) {
      if (cause instanceof ShoppingAccessError || cause instanceof ShoppingSessionError) {
        setSnapshot(null);
        await discardShoppingCache();
      } else setCachedOnly(true);
      setError(displayError(cause, "買い物リストを読み込めませんでした。"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(item: ShoppingItem) {
    if (!accessToken || !userId || !snapshot || !online || cachedOnly || saving || actionBusy) return;
    const previousSnapshot = snapshot;
    setSaving(true);
    setError("");
    // 表示は即時に更新し、端末キャッシュには保存が確定した結果だけを入れる。
    setSnapshot(withShoppingItemChecked(snapshot, item, !item.checked));
    try {
      const saved = await saveShoppingChecked(accessToken, previousSnapshot, item);
      if (currentUserId.current === userId) acceptShopping(saved, userId);
    } catch (cause) {
      if (currentUserId.current !== userId) return;
      setSnapshot(previousSnapshot);
      if (cause instanceof ShoppingAccessError || cause instanceof ShoppingSessionError) { setSnapshot(null); await discardShoppingCache(); }
      setError(displayError(cause, "保存できませんでした。接続を確認してください。"));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: ShoppingAction, successMessage: string) {
    if (!accessToken || !userId || !snapshot || !online || cachedOnly || actionBusy || saving || loading) return;
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      acceptShopping(await performShoppingAction(accessToken, snapshot, action), userId);
      setNotice(successMessage);
      if (action.action === "add") setNewItemName("");
    } catch (cause) {
      if (cause instanceof ShoppingAccessError || cause instanceof ShoppingSessionError) { setSnapshot(null); await discardShoppingCache(); }
      setError(displayError(cause, "保存できませんでした。接続を確認してください。"));
    } finally {
      setActionBusy(false);
    }
  }

  async function signOut() {
    authReady.current = false;
    currentUserId.current = null;
    try { await discardShoppingCache(); }
    catch { setError("端末内の保存済みリストを削除できませんでした。端末の保存領域を確認してください。"); }
    try { await clearReminderSettings(); }
    catch { setError("端末の通知を解除できませんでした。端末の設定で通知をOFFにしてください。"); }
    await supabase?.auth.signOut();
    setAccessToken(null);
    setUserId(null);
    setSnapshot(null);
    setCachedOnly(false);
    setTodaySnapshot(null);
    setReminderSettings(defaultReminderSettings);
    setNotice("");
  }

  async function saveReminders() {
    setReminderBusy(true);
    setReminderMessage("");
    try {
      await saveReminderSettings(reminderSettings);
      setReminderMessage("通知設定を保存しました。次の予定時刻に端末でお知らせします。");
    } catch (cause) {
      setReminderMessage(displayError(cause, "通知設定を保存できませんでした。"));
    } finally {
      setReminderBusy(false);
    }
  }

  const items = snapshot ? [
    ...snapshot.groups.flatMap((group) => group.items),
    ...snapshot.manualItems,
  ] : [];
  const remaining = items.filter((item) => !item.checked).length;
  const shoppingReadOnly = !online || cachedOnly;

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
      </section> : restoringSession ? <p className="loading" role="status">ログイン状態を確認中…</p> : !accessToken ? <section className="login-card">
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
        <p className="hint">ログイン状態はこの端末の安全な保存領域で管理します。</p>
      </section> : <>
        <nav className="mobile-tabs" aria-label="主な画面">
          <button type="button" aria-current={activeTab === "today" ? "page" : undefined} onClick={() => setActiveTab("today")}>今日</button>
          <button type="button" aria-current={activeTab === "shopping" ? "page" : undefined} onClick={() => setActiveTab("shopping")}>買い物</button>
          <button type="button" aria-current={activeTab === "settings" ? "page" : undefined} onClick={() => setActiveTab("settings")}>設定</button>
        </nav>
        {activeTab === "settings" ? <section className="settings-page">
          <div className="page-heading"><span className="section-tag">SETTINGS</span><h1>お知らせ</h1>
            <p>必要な通知だけを、この端末で受け取れます。初期設定はOFFです。</p></div>
          {remindersAvailable() ? <>
            <ReminderEditor title="買い物" description="買い物リストを確認する時間"
              value={reminderSettings.shopping} onChange={(shopping) => setReminderSettings({ ...reminderSettings, shopping })} />
            <ReminderEditor title="仕込み" description="今日の段取りを確認する時間"
              value={reminderSettings.preparation} onChange={(preparation) => setReminderSettings({ ...reminderSettings, preparation })} />
            <button className="primary-button" type="button" disabled={reminderBusy} onClick={() => void saveReminders()}>
              {reminderBusy ? "保存中…" : "通知設定を保存"}</button>
            {reminderMessage && <p className="notice-message" role="status">{reminderMessage}</p>}
            <p className="read-only-note">通知は端末の状況により遅れる場合があります。ログアウトすると予約は解除されます。</p>
          </> : <p className="read-only-note">通知はスマホアプリで設定できます。</p>}
        </section> : activeTab === "today" ? <section className="today-page">
          <div className="page-heading"><span className="section-tag">TODAY</span><h1>今日の献立</h1>
            <p>{todaySnapshot ? `${formatDate(todaySnapshot.today.date)}（${todaySnapshot.today.dow}）` :
              todayError ? "今日の内容を表示できません" : "今日の内容を確認中…"}</p></div>
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

        {snapshot && <p className={!shoppingReadOnly && !error ? "sync-status" : "sync-status stale"} role="status">
          {!shoppingReadOnly && !error ? "● 最新の買い物リスト" : "● オフライン・保存済みのリスト（変更には接続が必要です）"}
          <small>取得：{formatTimestamp(snapshot.fetchedAt)}</small>
        </p>}

        {error && <p className="error-message" role="alert">{error}</p>}
        {notice && <p className="notice-message" role="status">{notice}</p>}
        {!snapshot && !error && <p className="loading" role="status">買い物リストを読み込み中…</p>}
        {snapshot && <>
          <section className="period-controls" aria-label="買い物の期間">
            <div className="period-buttons">
              <button type="button" aria-pressed={snapshot.period.mode === "today"} disabled={shoppingReadOnly || actionBusy || saving}
                onClick={() => void runAction({ action: "period", mode: "today" }, "今日のリストに切り替えました。")}>今日</button>
              <button type="button" aria-pressed={snapshot.period.mode === "week"} disabled={shoppingReadOnly || actionBusy || saving}
                onClick={() => void runAction({ action: "period", mode: "week" }, "7日間のリストに切り替えました。")}>7日間</button>
              <button type="button" aria-pressed={snapshot.period.mode === "custom"} disabled={shoppingReadOnly || actionBusy || saving}
                onClick={() => { setCustomStart(snapshot.period.start); setCustomEnd(snapshot.period.end); }}>期間指定</button>
            </div>
            {customStart && <form className="custom-period" onSubmit={(event) => {
              event.preventDefault();
              void runAction({ action: "period", mode: "custom", start: customStart, end: customEnd }, "期間を変更しました。");
            }}>
              <label>開始日<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} required /></label>
              <label>終了日<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} required /></label>
              <button type="submit" disabled={shoppingReadOnly || actionBusy || saving}>この期間を表示</button>
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
              <button type="submit" disabled={shoppingReadOnly || actionBusy || saving || !newItemName.trim()}>追加</button></div>
          </form>
          {items.some((item) => item.checked) && <button className="complete-button" type="button"
            disabled={shoppingReadOnly || actionBusy || saving} onClick={() => void runAction({ action: "complete" }, "買い物の完了を保存しました。")}>チェックした品を買い物完了にする</button>}
          {snapshot.latestCompletion && <button className="undo-button" type="button" disabled={shoppingReadOnly || actionBusy || saving}
            onClick={() => void runAction({ action: "undo", completionId: snapshot.latestCompletion!.id }, "直前の買い物完了を取り消しました。")}>直前の完了を取り消す</button>}
          {snapshot.groups.map((group) => <ShoppingGroup key={group.category} title={group.category} items={group.items}
            disabled={shoppingReadOnly || saving || actionBusy} onToggle={toggleItem}
            onDismiss={group.category === "調味料(在庫確認)" ? (item) => runAction({ action: "dismiss", category: item.category, name: item.name, position: item.position }, "調味料をリストから外しました。") : undefined} />)}
          {snapshot.manualItems.length > 0 && <ShoppingGroup title="手動で追加したもの" items={snapshot.manualItems}
            disabled={shoppingReadOnly || saving || actionBusy} onToggle={toggleItem}
            onDelete={(item) => item.id ? runAction({ action: "delete", id: item.id }, "買うものを削除しました。") : Promise.resolve()} />}
          {items.length === 0 && <p className="empty">この期間に買うものはありません。</p>}
          {snapshot.hasDismissedSeasonings && <button className="restore-button" type="button" disabled={shoppingReadOnly || actionBusy || saving}
            onClick={() => void runAction({ action: "restore" }, "非表示にした調味料を戻しました。")}>非表示の調味料を戻す</button>}
          {snapshot.warnings.length > 0 && <section className="warning-card">
            <h2>確認したいこと</h2>
            <ul>{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>}
          <p className="read-only-note">{saving ? "チェックを保存中…" : "品物をタップするとチェックを保存します。圏外では変更できません。"}</p>
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

function ReminderEditor({ title, description, value, onChange }: {
  title: string; description: string; value: Reminder; onChange: (value: Reminder) => void;
}) {
  return <section className="reminder-card">
    <label className="reminder-toggle"><input type="checkbox" checked={value.enabled}
      onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />
      <span><strong>{title}</strong><small>{description}</small></span></label>
    {value.enabled && <div className="reminder-fields">
      <label>曜日<select value={value.weekday} onChange={(event) => onChange({ ...value, weekday: Number(event.target.value) })}>
        {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => <option key={day} value={index}>{day}曜日</option>)}
      </select></label>
      <label>時刻<input type="time" value={value.time} onChange={(event) => onChange({ ...value, time: event.target.value })} /></label>
    </div>}
  </section>;
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

function displayError(cause: unknown, fallback: string) {
  if (cause instanceof TypeError || (cause instanceof Error && /load failed|failed to fetch|networkerror/i.test(cause.message))) {
    return "データに接続できません。通信状況を確認し、時間をおいて再度お試しください。";
  }
  return cause instanceof Error ? cause.message : fallback;
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "不明" : date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
