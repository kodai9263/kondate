"use client";

import { createRecipe } from "@/app/app/recipes/new/actions";
import { PendingButton } from "@/components/ui/PendingButton";

const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 py-2 text-base font-normal focus:border-kondate-accent";
export function RecipeForm() {
  return <div className="mt-6 space-y-6">
    <p className="rounded-lg border border-kondate-line bg-white p-4 text-sm leading-7 text-kondate-muted">URL取り込みは現在休止中です。ご自身のレシピを手入力で登録できます。</p>
    <form action={createRecipe} className="space-y-5">
      <fieldset className="space-y-5">
        <label className="block text-sm font-semibold">料理名（必須）<input className={inputClass} name="name" required maxLength={80} /></label>
        <input type="hidden" name="side" value="" />
        <input type="hidden" name="servings" value="4" />
        <input type="hidden" name="cookMinutes" value="25" />
        <input type="hidden" name="proteinSource" value="meat" />
        <label className="block text-sm font-semibold">材料（必須）<textarea className={inputClass} rows={6} name="ingredients" required maxLength={4000} placeholder="1行に1つ、食材と分量を入力" /></label>
        <label className="block text-sm font-semibold">作り方（必須）<textarea className={inputClass} rows={8} name="steps" required maxLength={4000} placeholder="1行に1つの手順を入力" /></label>
        <PendingButton>わが家のメニューに保存</PendingButton>
      </fieldset>
    </form>
  </div>;
}
