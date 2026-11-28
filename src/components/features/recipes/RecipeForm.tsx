"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importRecipeFromUrl, saveRecipe } from "@/app/app/recipes/new/actions";
import { organizeSteps } from "@/lib/recipes/organizeSteps";
import type { PrivateImportedRecipe } from "@/lib/recipes/privateImport";

const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 py-2 text-base font-normal focus:border-kondate-accent";
const buttonClass = "min-h-12 rounded-lg bg-kondate-accent px-4 py-2 font-semibold text-white disabled:opacity-50";
export function RecipeForm() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<PrivateImportedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<FormData | null>(null);
  const locked = useRef(false);
  const [undo, setUndo] = useState<string | null>(null);
  const ids = useRef<{ id: string; requestId: string } | null>(null);
  function organize() {
    const field = form.current?.elements.namedItem("steps") as HTMLTextAreaElement;
    try { const next = organizeSteps(field.value); setUndo(field.value); field.value = next; setMessage("改行を整理しました。時間・火加減・順序を確認してから保存してください。"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "整理できませんでした。"); }
  }
  async function importUrl(event: React.FormEvent) {
    event.preventDefault(); if (locked.current || pending) return;
    if (form.current && ["name", "ingredients", "steps"].some(name => (form.current!.elements.namedItem(name) as HTMLInputElement).value) && !window.confirm("入力済みの料理名・材料・作り方を取り込み結果に置き換えますか？")) return;
    locked.current = true; setBusy(true); setMessage("");
    try {
      const result = await importRecipeFromUrl(url);
      if (!result.ok) { setMessage(result.message); return; }
      const recipe = result.recipe;
      for (const [name, value] of Object.entries({ name: recipe.name, ingredients: recipe.ingredients, steps: recipe.steps, servings: recipe.sourceServings ?? "", cookMinutes: recipe.cookMinutes ?? "", proteinSource: recipe.proteinSource })) {
        (form.current!.elements.namedItem(name) as HTMLInputElement).value = String(value);
      }
      setUndo(null); setSource(recipe);
      const confirmation = form.current?.elements.namedItem("importConfirmed") as HTMLInputElement | null;
      if (confirmation) confirmation.checked = false;
      setMessage("読み取りました。元のページと材料・作り方を確認してください。栄養値は自動登録しません。");
    } catch { setMessage("通信できませんでした。入力済みの内容は残っています。"); }
    finally { locked.current = false; setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current) return;
    const body = pending ?? new FormData(event.currentTarget);
    ids.current ??= { id: crypto.randomUUID(), requestId: crypto.randomUUID() };
    body.set("id", ids.current.id); body.set("requestId", ids.current.requestId);
    setPending(body); locked.current = true; setBusy(true); setMessage("");
    try {
      const result = await saveRecipe(body);
      if (result.ok) { router.push("/app/recipes?created=household"); router.refresh(); return; }
      setMessage(result.message);
      // 入力検証の失敗では修正可能にする。保存結果不明の場合は同じ内容だけを再送する。
      if (result.code !== "save") setPending(null);
    } catch { setMessage("保存結果を確認できません。同じ内容でもう一度保存を押してください。"); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="mt-6 space-y-6">
    <form onSubmit={event => void importUrl(event)} className="space-y-3 rounded-lg border border-kondate-line bg-white p-4">
      <label className="block text-sm font-semibold">レシピのURL<input type="url" className={inputClass} value={url} onChange={event => setUrl(event.target.value)} maxLength={2048} required disabled={busy || !!pending} placeholder="https://www.kikkoman.co.jp/homecook/search/recipe/…" /></label>
      <p className="text-sm text-kondate-muted">キッコーマンの対応ページから材料・作り方を読み取ります。その他のサイトは下の欄へ入力・貼り付けできます。</p>
      <button className={buttonClass} disabled={busy || !!pending}>材料・作り方を読み取る</button>
    </form>
    <p className="text-sm leading-7 text-kondate-muted">保存したメニューは、ご自身と同じ家族グループのメンバーが利用できます。外部サイトを参考にする場合は、利用条件を確認し、保存・利用が認められている範囲で入力してください。写真や紹介文の無断転載はお控えください。</p>
    <form ref={form} onSubmit={event => void save(event)} className="space-y-5">
      <fieldset className="space-y-5" disabled={busy || !!pending}>
        <label className="block text-sm font-semibold">料理名（必須）<input className={inputClass} name="name" required maxLength={80} /></label>
        <input type="hidden" name="side" value="" />
        <label className="block text-sm font-semibold">何人分の材料ですか<input type="number" className={inputClass} name="servings" min={1} max={20} step={1} required defaultValue={4} /></label>
        {source && <p className="text-sm">元の表記：{source.sourceServingsText || "人数不明"}。分量はそのままです。範囲表記の場合は、何人分として使うかを選んでください。</p>}
        <label className="block text-sm font-semibold">完成までの時間（分）<input type="number" className={inputClass} name="cookMinutes" min={1} max={240} step={1} required defaultValue={25} /></label>
        <label className="block text-sm font-semibold">主なたんぱく源<select className={inputClass} name="proteinSource" defaultValue="meat"><option value="meat">肉</option><option value="fish">魚</option><option value="soy">大豆・豆腐</option><option value="egg">卵</option><option value="noodle">麺・その他</option></select></label>
        <label className="block text-sm font-semibold">材料（必須）<textarea className={inputClass} rows={6} name="ingredients" required maxLength={4000} placeholder="1行に1つ、食材と分量を入力" /></label>
        <label className="block text-sm font-semibold">作り方（必須）<textarea className={inputClass} rows={8} name="steps" required maxLength={4000} placeholder="作り方を入力・貼り付けできます" /></label>
        <button type="button" className={buttonClass} onClick={organize}>作り方の改行を整理</button>{undo !== null && <button type="button" className="ml-3 underline" onClick={() => { (form.current!.elements.namedItem("steps") as HTMLTextAreaElement).value = undo!; setUndo(null); setMessage("整理前に戻しました。"); }}>整理前に戻す</button>}
        <p className="text-sm text-kondate-muted">改行を整える機能です。内容の要約や言い換え、利用許諾の確認は行いません。</p>
        {source && <div className="space-y-3">
          <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">元のレシピを確認する（キッコーマン）</a>
          <input type="hidden" name="sourceUrl" value={source.sourceUrl} /><input type="hidden" name="sourceServingsText" value={source.sourceServingsText} />
          <label className="block"><input type="checkbox" name="importConfirmed" value="yes" required /> 材料・分量・人数・作り方と、保存・利用できる範囲を確認しました</label>
        </div>}
      </fieldset>
      {message && <p role="status" className="text-sm leading-7">{message}</p>}
      <button type="submit" className={buttonClass} disabled={busy}>{busy ? "処理中…" : pending ? "同じ内容で保存を確認" : "わが家のメニューに保存"}</button>
    </form>
  </div>;
}
