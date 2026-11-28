import { useRef, useState } from "react";
import type { PrivateImportedRecipe } from "../../src/lib/recipes/privateImport";

export function RecipeImportControls({ accessToken, disabled, onImport, onBusy }: { accessToken: string; disabled: boolean; onImport: (recipe: PrivateImportedRecipe) => void; onBusy: (busy: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function read(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || disabled) return;
    lock.current = true; onBusy(true); setMessage("");
    try {
      const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
      const response = await fetch(`${base}/api/mobile/v1/recipes/import`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(20000) });
      const value = await response.json();
      if (!response.ok) throw new Error(response.status === 429 ? "10秒ほど待ってから再試行してください。" : response.status === 401 ? "ログインし直してください。" : value.message ?? "取り込めませんでした。通信と家族の利用状況を確認してください。");
      if (value.version !== 1 || !value.recipe || typeof value.recipe.steps !== "string") throw new Error("取り込み内容を確認できませんでした。");
      onImport(value.recipe); setMessage("読み取りました。元のページと材料・作り方を確認してください。栄養値は自動登録しません。");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "取り込めませんでした。入力済みの内容は残っています。"); }
    finally { lock.current = false; onBusy(false); }
  }
  return <form className="menu-editor" onSubmit={event => void read(event)}>
    <label>レシピのURL<input type="url" required maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} disabled={disabled} /></label>
    <p>キッコーマンの対応ページから材料・作り方を読み取ります。その他のサイトは下の欄へ入力・貼り付けできます。</p>
    <button className="secondary-button" disabled={disabled}>材料・作り方を読み取る</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
