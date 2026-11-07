import { useEffect, useState, type FormEvent } from "react";
import { commonAllergens, getCustomAllergies, normalizeAllergies, parseCustomAllergies } from "../../src/lib/family/allergies";
import { planningAccessMessage } from "./planningAccess";

type Setup = { version: 1; adults: number; children: number; allergies: string[]; start: string };
async function requestSetup(token: string, input?: Record<string, unknown>) {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${base}/api/mobile/v1/setup`, {
    method: input ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}), cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(planningAccessMessage(data?.error) ?? (response.status === 400 ? "人数・日付・アレルギーの確認を見直してください。" : "設定を確認・保存できませんでした。接続を確認してお試しください。"));
  return data;
}
export function FirstWeekSetup({ accessToken, online, onSaved }: { accessToken: string; online: boolean; onSaved: () => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (online) void requestSetup(accessToken).then((data) => {
      if (data?.version !== 1 || !Number.isInteger(data.adults) || !Number.isInteger(data.children) || !Array.isArray(data.allergies) || typeof data.start !== "string") throw new Error("設定の形式を確認できませんでした。");
      if (!cancelled) { setSetup(data); setError(""); }
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "設定を読み込めませんでした。"); });
    return () => { cancelled = true; };
  }, [accessToken, online, retry]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !online) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError("");
    try {
      await requestSetup(accessToken, { adults: Number(form.get("adults")), children: Number(form.get("children")), start: form.get("start"),
        confirmed: form.get("confirmed") === "yes", allergies: normalizeAllergies([...form.getAll("allergies"), ...parseCustomAllergies(form.get("otherAllergies"))]) });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "設定を保存できませんでした。"); }
    finally { setSaving(false); }
  }
  return <section className="first-week-setup" aria-label="最初の献立設定">
    <h2>人数とアレルギーを確認</h2><p>家族に合わせた献立を、このアプリで始められます。</p>
    {!online && <p className="warning-card">設定には通信が必要です。</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {!setup && online && !error && <p role="status">設定を読み込み中…</p>}
    {!setup && error && <button disabled={!online} onClick={() => setRetry(n => n + 1)}>もう一度確認</button>}
    {setup && <form onSubmit={save}><fieldset disabled={saving || !online} className="first-week-fields">
      <label>大人<input name="adults" type="number" min={1} max={10} required defaultValue={setup.adults} /></label>
      <label>子ども<input name="children" type="number" min={0} max={10} required defaultValue={setup.children} /></label>
      <label>献立の表示開始日<input name="start" type="date" min="2020-01-01" max="2100-12-25" required defaultValue={setup.start} /></label>
      <p>避けたいアレルギー食材</p><div className="first-week-allergies">{commonAllergens.map(a => <label key={a}><input type="checkbox" name="allergies" value={a} defaultChecked={setup.allergies.includes(a)} />{a}</label>)}</div>
      <label>その他の食材<input name="otherAllergies" maxLength={500} defaultValue={getCustomAllergies(setup.allergies).join("、")} placeholder="食材を読点で区切って入力" /></label>
      <p className="settings-help">食材照合は補助です。調味料・加工品の原材料表示も確認してください。表示開始日を変えても無料体験の期間は延長されません。</p>
      <label className="first-week-confirm"><input name="confirmed" type="checkbox" value="yes" required />アレルギーを確認しました（ない場合もチェック）</label>
      <button className="primary-button" type="submit">{saving ? "保存中…" : "献立を始める"}</button>
    </fieldset></form>}
  </section>;
}
