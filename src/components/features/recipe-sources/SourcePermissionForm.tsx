"use client";

import { useActionState, useId, useState } from "react";
import { saveSourcePermission } from "@/app/admin/recipe-sources/actions";
import { permissionStatuses, type SourceInventoryItem } from "@/lib/recipes/sources";

const field = "mt-1 w-full rounded border border-kondate-line bg-white px-3 py-2 text-base font-normal";
export function SourcePermissionForm({ item }: { item: SourceInventoryItem }) {
  const [state, action, pending] = useActionState(saveSourcePermission, { ok: false, message: "" });
  const id = useId();
  return <form action={action} className="mt-4 grid gap-4" aria-label={`${item.name}の提供元・承諾情報`}>
    <input type="hidden" name="recipeId" value={item.id} />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">提供元のサイト名<input className={field} name="providerName" maxLength={160} defaultValue={item.source.provider_name === "提供元未登録" ? "" : item.source.provider_name} /></label>
      <label className="text-sm font-semibold">作者・チャンネル名<input className={field} name="authorName" maxLength={160} defaultValue={item.source.author_name} /></label>
    </div>
    <label className="text-sm font-semibold">元URL<input className={field} name="sourceUrl" type="url" maxLength={2000} defaultValue={item.source.source_url} /></label>
    <label className="text-sm font-semibold">動画の開始位置（秒・YouTubeのみ）<input className={field} name="videoStartSeconds" type="number" min={0} max={86400} step={1} defaultValue={item.source.video_start_seconds ?? ""} /></label>
    <fieldset className="grid gap-4 rounded bg-kondate-bg p-4">
      <legend className="text-sm font-semibold">あなたのみ閲覧できる承諾記録</legend>
      <label className="text-sm font-semibold">承諾状況<select className={field} name="status" defaultValue={item.permission?.status ?? "unreviewed"}>{Object.entries(permissionStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold">許可された掲載内容<textarea className={field} name="allowedScope" maxLength={4000} rows={3} defaultValue={item.permission?.allowed_scope ?? ""} placeholder="例：材料と手順の掲載、出典リンクの記載" /></label>
      <label className="text-sm font-semibold">確認日<input className={field} name="checkedOn" type="date" defaultValue={item.permission?.checked_on ?? ""} /></label>
      <label className="text-sm font-semibold">承諾・依頼の記録<textarea className={field} name="evidence" maxLength={8000} rows={4} defaultValue={item.permission?.evidence ?? ""} placeholder="連絡日、相手の回答、メールの参照先など" /></label>
      <p className="text-xs leading-6 text-kondate-muted">承諾済みには掲載内容・確認日・記録の入力が必要です。ここでの保存ではメニューの公開・非公開は切り替わりません。</p>
    </fieldset>
    {state.message ? <p id={id} role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p> : null}
    <button disabled={pending} aria-describedby={state.message ? id : undefined} className="min-h-11 rounded bg-kondate-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "保存中…" : "提供元・承諾記録を保存"}</button>
  </form>;
}

export function CopySourceList({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return <div><button type="button" className="min-h-11 rounded border border-kondate-line px-3 text-sm" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setMessage("料理名と元URLをコピーしました。"); }
    catch { setMessage("コピーできませんでした。下の一覧を選択してコピーしてください。"); }
  }}>依頼用のメニュー一覧をコピー</button><p role="status" className="mt-1 text-xs">{message}</p><details className="mt-2 text-sm"><summary className="cursor-pointer">依頼用の一覧を見る</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded bg-white p-3 font-sans text-sm">{text}</pre></details></div>;
}
