"use client";

import { useRef, useState } from "react";
import { createRecipe, importRecipeFromUrl } from "@/app/app/recipes/new/actions";
import { PendingButton } from "@/components/ui/PendingButton";
import { Button } from "@/components/ui/Button";

const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 py-2 text-base font-normal focus:border-kondate-accent";
export function RecipeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [url, setUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const importing = useRef(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  async function importUrl() {
    if (importing.current) return;
    importing.current = true; setBusy(true); setError("");
    try {
      const result = await importRecipeFromUrl(url);
      if (!result.ok) { setError(result.message); return; }
      const recipe = result.recipe;
      const form = formRef.current;
      if (!form) return;
      const values = { name: recipe.name, side: "", servings: recipe.sourceServings ?? "", cookMinutes: recipe.cookMinutes && recipe.cookMinutes <= 240 ? recipe.cookMinutes : "", proteinSource: recipe.proteinSource, ingredients: recipe.ingredients, steps: recipe.steps };
      for (const [name, value] of Object.entries(values)) {
        const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (field) field.value = String(value);
      }
      const confirmed = form.elements.namedItem("importConfirmed") as HTMLInputElement | null;
      if (confirmed) confirmed.checked = false;
      setSourceUrl(recipe.sourceUrl); setWarnings(recipe.warnings);
    } catch { setError("読み取りに失敗しました。通信を確認して、もう一度お試しください。"); }
    finally { importing.current = false; setBusy(false); }
  }
  return <div className="mt-6 space-y-6">
    <section aria-labelledby="recipe-import-heading" className="rounded-lg border border-kondate-line bg-white p-4">
      <h2 id="recipe-import-heading" className="font-semibold">レシピのURLから取り込む</h2>
      <p className="mt-2 text-sm leading-6 text-kondate-muted">クックパッド・Nadiaの材料と作り方を読み取ります。保存した料理を献立に選ぶと、買い物リストにも反映されます。</p>
      <label className="mt-3 block text-sm font-semibold">レシピURL<input className={inputClass} type="url" value={url} onChange={event => setUrl(event.target.value)} disabled={busy} maxLength={2048} placeholder="https://cookpad.com/jp/recipes/…" /></label>
      <Button type="button" className="mt-3" disabled={busy || !url.trim()} onClick={() => void importUrl()}>{busy ? "読み取り中…" : "材料・作り方を読み取る"}</Button>
      <p className="mt-2 text-xs leading-6 text-kondate-muted">読み取ると、下の入力欄を置き換えます。取り込んだ料理は家族内だけで保存します。</p>
      {error ? <p role="alert" className="mt-3 text-sm text-kondate-alert">{error}</p> : null}
    </section>
    <form ref={formRef} action={createRecipe} className="space-y-5">
      <input type="hidden" name="sourceUrl" value={sourceUrl} />
      <fieldset disabled={busy} className="space-y-5">
        {sourceUrl ? <div role="status" className="rounded-lg bg-kondate-bg p-4 text-sm leading-7"><p>読み取りました。元の分量のまま入力しています。</p><a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">元のレシピを確認</a>{warnings.map(warning => <p key={warning}>{warning}</p>)}</div> : <p className="text-sm leading-7 text-kondate-muted">URLを使わず、直接入力して保存することもできます。</p>}
        <label className="block text-sm font-semibold">料理名（必須）<input className={inputClass} name="name" required maxLength={80} /></label>
        <label className="block text-sm font-semibold">副菜・汁物<input className={inputClass} name="side" maxLength={120} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-semibold">何人分（必須）<input className={inputClass} name="servings" type="number" min={1} max={20} required defaultValue={4} /></label>
          <label className="text-sm font-semibold">完成までの時間（分）<input className={inputClass} name="cookMinutes" type="number" min={1} max={240} required defaultValue={25} /></label>
        </div>
        <label className="block text-sm font-semibold">主なたんぱく源<select className={inputClass} name="proteinSource" defaultValue="meat"><option value="fish">魚</option><option value="meat">肉</option><option value="soy">大豆・豆腐</option><option value="egg">卵</option><option value="noodle">麺・その他</option></select></label>
        <label className="block text-sm font-semibold">材料（必須）<textarea className={inputClass} rows={6} name="ingredients" required maxLength={4000} placeholder="1行に1つ、食材と分量を入力" /></label>
        <label className="block text-sm font-semibold">作り方（必須）<textarea className={inputClass} rows={8} name="steps" required maxLength={4000} placeholder="1行に1つの手順を入力" /></label>
        {sourceUrl ? <label className="flex min-h-11 items-start gap-3 text-sm leading-7"><input className="mt-1 h-5 w-5" type="checkbox" name="importConfirmed" value="yes" required />材料・作り方と何人分かを確認しました</label> : null}
        <PendingButton>わが家のメニューに保存</PendingButton>
      </fieldset>
    </form>
  </div>;
}
