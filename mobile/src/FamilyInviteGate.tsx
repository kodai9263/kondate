import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { supabase } from "./supabase";
import { clearShoppingCache } from "./shoppingCache";
import { inviteTokenFromUrl } from "./inviteLinks";
import { joinFamilyInvite, previewFamilyInvite } from "./inviteAcceptance";

type LinksPlugin = {
  pending(): Promise<{ url?: string }>;
  addListener(name: "inviteUrl", callback: (value: { url: string }) => void): Promise<PluginListenerHandle>;
};
const links = registerPlugin<LinksPlugin>("FamilyLinks");

export function FamilyInviteGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [input, setInput] = useState("");
  const [household, setHousehold] = useState("");
  const [ready, setReady] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [login, setLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const joining = useRef(false);
  const queuedUrl = useRef<string | null>(null);
  const [generation, setGeneration] = useState(0);

  function receive(url: string) {
    if (joining.current) { queuedUrl.current = url; return; }
    const parsed = inviteTokenFromUrl(url, import.meta.env.VITE_API_BASE_URL);
    if (!parsed) { setToken(null); setManual(true); setError("きょうのごはんの招待リンクを貼り付けてください。"); return; }
    setReady(false); setHousehold(""); setSignedIn(false); setPreviewEpoch(value => value + 1);
    setToken(parsed); setManual(false); setError(""); setLogin(false);
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let listener: PluginListenerHandle | undefined;
    let received = false;
    void links.addListener("inviteUrl", ({ url }) => { if (active) { received = true; receive(url); } }).then(async handle => {
      if (!active) { await handle.remove(); return; }
      listener = handle;
      const result = await links.pending();
      if (active && !received && result.url) receive(result.url);
    }).catch(() => { if (active) setError("リンクを読み取れませんでした。「家族の招待リンクを開く」から貼り付けてください。"); });
    return () => { active = false; void listener?.remove(); };
  }, []);

  useEffect(() => {
    if (!token || !supabase) return;
    let active = true;
    const client = supabase;
    void (async () => {
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw new Error("ログイン状態を確認できませんでした。");
      const name = await previewFamilyInvite(client, token);
      if (active) { setHousehold(name); setSignedIn(Boolean(data.session)); setReady(true); }
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "招待を確認できませんでした。"); });
    return () => { active = false; };
  }, [token, previewEpoch]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (!token || !supabase || joining.current || !ready) return;
    joining.current = true; setBusy(true); setError("");
    try {
      if (login && !signedIn) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw new Error("ログインできませんでした。メールアドレスとパスワードを確認してください。");
        setSignedIn(true); setPassword("");
      }
      // 消去に失敗した場合は所属を変更せず、前の家族のキャッシュ混在を防ぐ。
      try { await clearShoppingCache(); }
      catch { throw new Error("端末の保存情報を更新できませんでした。もう一度お試しください。"); }
      await joinFamilyInvite(supabase, token);
      setToken(null); setPassword(""); setInput(""); setGeneration(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "参加できませんでした。通信を確認してください。"); }
    finally {
      joining.current = false; setBusy(false);
      if (queuedUrl.current) { const url = queuedUrl.current; queuedUrl.current = null; receive(url); }
    }
  }

  if (token || manual) return <div className="app-shell"><main><section className="login-card">
    <h1>家族の招待</h1>
    {!supabase ? <p role="alert">アプリの接続設定を確認してください。</p> : !token ? <form onSubmit={event => { event.preventDefault(); receive(input); }}>
      <label htmlFor="family-invite-url">届いた招待リンク</label>
      <input id="family-invite-url" type="url" required value={input} onChange={event => setInput(event.target.value)} placeholder="https://…/invite/…" />
      <button className="primary-button" type="submit">招待を確認</button>
    </form> : <form onSubmit={event => void join(event)}>
      <p>{ready ? `${household} の献立と買い物リストを共有します。` : error ? "招待を確認できませんでした。" : "招待を確認中…"}</p>
      {ready && <>
        <p>{signedIn ? "現在のアカウントで参加します。表示する家族が切り替わります。これまでの家族のデータは削除されません。" : "メール登録なしでも、このアプリで家族に参加できます。"}</p>
        {!signedIn && <label><input type="checkbox" checked={login} disabled={busy} onChange={event => setLogin(event.target.checked)} />登録済みのアカウントで参加する</label>}
        {login && !signedIn && <><label htmlFor="invite-email">メールアドレス</label><input id="invite-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
          <label htmlFor="invite-password">パスワード</label><input id="invite-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "参加しています…" : "この家族に参加する"}</button>
      </>}
    </form>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {token && !ready && error && <button type="button" className="secondary-button" onClick={() => { setError(""); setPreviewEpoch(value => value + 1); }}>もう一度確認する</button>}
    <button type="button" className="secondary-button" disabled={busy} onClick={() => { setToken(null); setManual(false); setError(""); setPassword(""); }}>戻る</button>
  </section></main></div>;
  return <><div key={generation}>{children}</div><div className="family-invite-entry">
    <button type="button" className="text-button" onClick={() => { setManual(true); setError(""); }}>家族の招待リンクを開く</button>
    {error && <p role="alert">{error}</p>}
  </div></>;
}
