"use client";

import { useId, useState } from "react";
import { CookingBasics } from "@/components/features/recipes/CookingBasics";
import { scaleRecipeIngredient } from "@/lib/family/servings";

export type RecipeCookingGuideProps = {
  ingredients: string[];
  morning: string[];
  steps: string[];
  baseServings: number;
  totalMinutes?: number;
  notes?: string[];
  scalable?: boolean;
};

export function RecipeCookingGuide({ ingredients, morning, steps, baseServings, totalMinutes, notes = [], scalable = false }: RecipeCookingGuideProps) {
  const [servings, setServings] = useState(baseServings);
  const ingredientsTitleId = useId();
  const equipment = getRecipeEquipment([...morning, ...steps]);
  return <div className="mt-6 space-y-7">
    {totalMinutes ? <p className="text-sm text-kondate-muted">完成まで約{totalMinutes}分<span className="mt-1 block text-xs">下ごしらえ・待ち時間を含む{baseServings}人分の目安です。慣れないうちは余裕をもって始めてください。</span></p> : null}
    <CookingBasics />
    {equipment.length ? <section><h2 className="text-sm font-semibold">使う道具</h2><p className="mt-2 text-sm leading-7 text-kondate-muted">{equipment.join("・")}</p></section> : null}
    {notes.length > 0 ? <section className="border-l-2 border-kondate-accent bg-white p-4"><h2 className="text-sm font-semibold">この料理のポイント</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-7 text-kondate-muted">{notes.map((note) => <li key={note}>{note}</li>)}</ul></section> : null}
    <section aria-labelledby={ingredientsTitleId}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={ingredientsTitleId} className="font-mincho text-xl font-bold">材料・調味料</h2>{scalable ? <label className="flex items-center gap-2 text-sm">作る量<select aria-label="作る人数" value={servings} onChange={(event) => setServings(Number(event.target.value))} className="min-h-11 rounded border border-kondate-line bg-white px-3">{Array.from(new Set([baseServings, ...Array.from({ length: 16 }, (_, index) => index + 1)])).sort((a, b) => a - b).map((amount) => <option key={amount} value={amount}>{amount}人分</option>)}</select></label> : <p className="text-sm text-kondate-muted">{baseServings}人分</p>}</div>
      {ingredients.length ? <ul className="mt-3 divide-y divide-kondate-line">{ingredients.map((line, index) => <li key={index} className="py-3 text-[15px] leading-7">{scaleRecipeIngredient(line, servings, baseServings)}</li>)}</ul> : <p className="mt-3 text-sm text-kondate-muted">材料の登録がありません。元レシピの材料と分量を確認してください。</p>}
      {servings !== baseServings ? <p role="status" className="mt-2 text-sm leading-6 text-kondate-muted">材料を{servings}人分に換算しました。工程の時間はそのままなので、火の通りを確かめて調整してください。</p> : null}
    </section>
    {morning.length ? <StepList title="先にしておく仕込み" steps={morning} /> : null}
    <StepList title={morning.length ? "仕込みの後の作り方" : "作り方"} steps={steps} />
  </div>;
}

function getRecipeEquipment(steps: string[]) {
  const text = steps.join("\n");
  const equipment: [RegExp, string][] = [
    [/切る|切り|包丁/, "包丁とまな板"],
    [/フライパン/, "フライパンとふた"],
    [/鍋/, "鍋（別鍋とある場合は2つ）"],
    [/小鉢|混ぜる/, "ボウル・小鉢"],
    [/ざる|水を切る|水気を切る/, "ざる"],
    [/600W|レンジ/, "電子レンジ・レンジ対応の耐熱容器・ラップ"],
    [/炊飯/, "炊飯器"],
    [/グリル/, "魚焼きグリル"],
    [/オーブンを|オーブンで/, "オーブン・対応する耐熱皿・ミトン"],
    [/中心.*℃|中心温度|食品用温度計/, "食品用温度計"],
    [/油用温度計|揚げ物用温度計/, "揚げ物用温度計"],
    [/ハンドブレンダー/, "ハンドブレンダー"],
    [/ピーラー/, "ピーラー"],
    [/竹串/, "竹串"],
    [/トング/, "トング"],
    [/すりおろ|おろし器|大根.*おろし/, "おろし器"],
    [/ペーパー/, "キッチンペーパー（レンジ使用時は対応品）"],
    [/オーブンシート/, "オーブンシート"],
    [/アルミ箔/, "アルミ箔"],
  ];
  return equipment.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
}

function StepList({ title, steps }: { title: string; steps: string[] }) {
  return <section><h2 className="font-mincho text-xl font-bold">{title}</h2><ol className="mt-4 space-y-4">{steps.map((step, index) => <li key={index} className="flex items-start gap-3 rounded border border-kondate-line bg-white p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kondate-accentSoft text-sm font-semibold text-kondate-accent" aria-hidden="true">{index + 1}</span><p className="min-w-0 text-[15px] leading-7"><span className="sr-only">工程{index + 1}：</span>{step}</p></li>)}</ol></section>;
}
