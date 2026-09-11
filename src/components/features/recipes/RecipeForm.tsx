"use client";

import { Globe2, Home, Link2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createRecipe, importRecipeFromUrl } from "@/app/app/recipes/new/actions";
import { Button } from "@/components/ui/Button";
import { PendingButton } from "@/components/ui/PendingButton";
import type { ProteinSource } from "@/types/nutrition";

type RecipeFields = {
  name: string;
  side: string;
  cookMinutes: string;
  proteinSource: ProteinSource;
  ingredients: string;
  steps: string;
  energyKcal: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
  fiberG: string;
  saltG: string;
  vegetablesG: string;
};

const initialFields: RecipeFields = {
  name: "",
  side: "",
  cookMinutes: "25",
  proteinSource: "meat",
  ingredients: "",
  steps: "",
  energyKcal: "650",
  proteinG: "28",
  fatG: "20",
  carbsG: "85",
  fiberG: "8",
  saltG: "2.2",
  vegetablesG: "160",
};

export function RecipeForm({ canPublish }: { canPublish: boolean }) {
  const [fields, setFields] = useState(initialFields);
  const [recipeUrl, setRecipeUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [visibility, setVisibility] = useState<"household" | "community">("household");
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isImporting, startImport] = useTransition();

  function updateField(name: keyof RecipeFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function handleUrlChange(value: string) {
    setRecipeUrl(value);
    if (value !== sourceUrl) {
      setSourceUrl("");
      setVisibility("household");
      setImportMessage("");
      setWarnings([]);
    }
  }

  function handleImport() {
    setImportError("");
    setImportMessage("");
    setWarnings([]);
    startImport(async () => {
      const result = await importRecipeFromUrl(recipeUrl);
      if (!result.ok) {
        setImportError(result.message);
        return;
      }

      const imported = result.recipe;
      setFields((current) => ({
        ...current,
        name: imported.name,
        cookMinutes: imported.cookMinutes === null ? current.cookMinutes : String(imported.cookMinutes),
        proteinSource: imported.proteinSource,
        ingredients: imported.ingredients,
        steps: imported.steps,
        energyKcal: valueOrCurrent(imported.nutrition.energyKcal, current.energyKcal),
        proteinG: valueOrCurrent(imported.nutrition.proteinG, current.proteinG),
        fatG: valueOrCurrent(imported.nutrition.fatG, current.fatG),
        carbsG: valueOrCurrent(imported.nutrition.carbsG, current.carbsG),
        fiberG: valueOrCurrent(imported.nutrition.fiberG, current.fiberG),
        saltG: valueOrCurrent(imported.nutrition.saltG, current.saltG),
      }));
      setSourceUrl(imported.sourceUrl);
      setVisibility(canPublish ? "community" : "household");
      setWarnings(imported.warnings);
      setImportMessage(imported.sourceServings && imported.sourceServings !== 4
        ? `${imported.sourceServings}人分のレシピを4人分へ換算しました。内容を確認して保存してください。`
        : "レシピを読み取りました。内容を確認して保存してください。");
    });
  }

  return (
    <form
      action={createRecipe}
      className="mt-6 space-y-8"
      onSubmit={(event) => {
        if (visibility !== "community") return;
        const confirmed = window.confirm("この料理を「みんなのメニュー」として全家庭へ公開しますか？");
        if (!confirmed) event.preventDefault();
      }}
    >
      <section className="rounded-lg border border-kondate-line bg-white p-4 sm:p-5" aria-labelledby="recipe-import-title">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-kondate-accentSoft text-kondate-accent" aria-hidden="true"><Link2 size={20} /></span>
          <div>
            <h2 id="recipe-import-title" className="font-mincho text-lg font-bold">URLから入力</h2>
            <p id="recipe-import-help" className="mt-1 text-xs leading-6 text-kondate-muted">NadiaまたはCookpadの公開レシピを読み取り、4人分に整えます。</p>
          </div>
        </div>
        <label className="mt-4 block text-sm font-semibold" htmlFor="recipe-url">レシピURL</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            id="recipe-url"
            type="url"
            inputMode="url"
            value={recipeUrl}
            onChange={(event) => handleUrlChange(event.target.value)}
            placeholder="https://oceans-nadia.com/..."
            aria-describedby="recipe-import-help"
            className="min-h-12 min-w-0 rounded-lg border border-kondate-line bg-white px-3.5 text-base font-normal outline-none transition-colors placeholder:text-kondate-faint focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accent/15"
          />
          <Button type="button" variant="secondary" disabled={isImporting || !recipeUrl.trim()} onClick={handleImport} className="sm:min-w-36">
            {isImporting ? "読み取り中..." : "URLから読み取る"}
          </Button>
        </div>
        {importError ? <p role="alert" className="mt-3 rounded bg-kondate-alertSoft px-3 py-2 text-sm leading-6 text-kondate-alert">{importError}</p> : null}
        {importMessage ? <div role="status" className="mt-3 rounded bg-kondate-doneSoft px-3 py-2 text-sm leading-6"><p>{importMessage}</p>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-10 items-center text-xs text-kondate-accent underline underline-offset-4">元ページと照らし合わせる</a> : null}{warnings.length > 0 ? <ul className="mt-1 list-disc pl-5 text-xs text-kondate-muted">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}</div> : null}
      </section>

      <input type="hidden" name="sourceUrl" value={sourceUrl} />

      <fieldset className="space-y-4"><legend className="mb-4 text-sm font-semibold">料理の基本</legend>
        <Field label="料理名" name="name" value={fields.name} onChange={(value) => updateField("name", value)} required />
        <Field label="副菜・汁物" name="side" value={fields.side} onChange={(value) => updateField("side", value)} helper="一緒に食べたい副菜や汁物を入力します。" />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="調理時間" name="cookMinutes" unit="分" value={fields.cookMinutes} onChange={(value) => updateField("cookMinutes", value)} />
          <label className="block text-sm font-semibold">主なたんぱく源 <Required /><select name="proteinSource" required value={fields.proteinSource} onChange={(event) => updateField("proteinSource", event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 text-base font-normal outline-none transition-colors focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accent/15"><option value="fish">魚</option><option value="meat">肉</option><option value="soy">大豆・豆腐</option><option value="egg">卵</option><option value="noodle">麺・その他</option></select></label>
        </div>
        <TextArea label="材料" name="ingredients" value={fields.ingredients} onChange={(value) => updateField("ingredients", value)} helper="1行に1つずつ書くと、あとから買い物リストへ変換しやすくなります。" />
        <TextArea label="作り方" name="steps" value={fields.steps} onChange={(value) => updateField("steps", value)} />
      </fieldset>

      <fieldset><legend className="text-sm font-semibold">1人分の栄養目安</legend><p className="mt-2 rounded border border-kondate-line bg-white p-3 text-xs leading-6 text-kondate-muted">レシピや商品表示を参考に、わかる範囲の目安を入力してください。医療上の栄養指導ではありません。</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberField label="エネルギー" name="energyKcal" unit="kcal" value={fields.energyKcal} onChange={(value) => updateField("energyKcal", value)} />
          <NumberField label="たんぱく質" name="proteinG" unit="g" value={fields.proteinG} onChange={(value) => updateField("proteinG", value)} step="0.1" />
          <NumberField label="脂質" name="fatG" unit="g" value={fields.fatG} onChange={(value) => updateField("fatG", value)} step="0.1" />
          <NumberField label="炭水化物" name="carbsG" unit="g" value={fields.carbsG} onChange={(value) => updateField("carbsG", value)} step="0.1" />
          <NumberField label="食物繊維" name="fiberG" unit="g" value={fields.fiberG} onChange={(value) => updateField("fiberG", value)} step="0.1" />
          <NumberField label="塩分" name="saltG" unit="g" value={fields.saltG} onChange={(value) => updateField("saltG", value)} step="0.1" />
          <NumberField label="野菜量" name="vegetablesG" unit="g" value={fields.vegetablesG} onChange={(value) => updateField("vegetablesG", value)} step="0.1" />
        </div>
      </fieldset>

      {canPublish ? <fieldset className="rounded-lg border border-kondate-line bg-white p-4"><legend className="px-1 text-sm font-semibold">公開先</legend><div className="mt-1 grid gap-2 sm:grid-cols-2">
        <VisibilityOption checked={visibility === "household"} value="household" onChange={() => setVisibility("household")} icon={<Home size={18} />} title="わが家だけ" description="家族の献立候補に追加" />
        <VisibilityOption checked={visibility === "community"} value="community" onChange={() => setVisibility("community")} icon={<Globe2 size={18} />} title="みんなに公開" description="全家庭の次回生成から候補に追加" disabled={!sourceUrl} />
      </div>{!sourceUrl ? <p className="mt-2 text-xs leading-6 text-kondate-faint">みんなに公開するには、上のURLからレシピを読み取ってください。</p> : null}</fieldset> : <input type="hidden" name="visibility" value="household" />}

      <PendingButton>{visibility === "community" ? "みんなのメニューに公開" : "メニューを保存"}</PendingButton>
    </form>
  );
}

function Required() { return <span className="text-xs font-normal text-kondate-faint">（必須）</span>; }

function Field({ label, name, value, onChange, required = false, helper }: { label: string; name: string; value: string; onChange: (value: string) => void; required?: boolean; helper?: string }) {
  return <label className="block text-sm font-semibold">{label} {required ? <Required /> : null}<input name={name} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 text-base font-normal outline-none transition-colors focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accent/15" />{helper ? <span className="mt-1 block text-xs font-normal leading-6 text-kondate-faint">{helper}</span> : null}</label>;
}

function TextArea({ label, name, value, onChange, helper }: { label: string; name: string; value: string; onChange: (value: string) => void; helper?: string }) {
  return <label className="block text-sm font-semibold">{label} <Required /><textarea name={name} value={value} onChange={(event) => onChange(event.target.value)} required rows={5} className="mt-2 w-full rounded-lg border border-kondate-line bg-white p-3.5 text-base font-normal outline-none transition-colors focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accent/15" />{helper ? <span className="mt-1 block text-xs font-normal leading-6 text-kondate-faint">{helper}</span> : null}</label>;
}

function NumberField({ label, name, unit, value, onChange, step = "1" }: { label: string; name: string; unit: string; value: string; onChange: (value: string) => void; step?: string }) {
  return <label className="block text-sm font-semibold">{label} <Required /><span className="mt-2 flex min-h-12 items-center rounded-lg border border-kondate-line bg-white transition-colors focus-within:border-kondate-accent focus-within:ring-2 focus-within:ring-kondate-accent/15"><input name={name} type="number" inputMode="decimal" min="0" step={step} required value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 text-base font-normal outline-none" /><span className="pr-3 text-xs font-normal text-kondate-faint">{unit}</span></span></label>;
}

function VisibilityOption({ checked, value, onChange, icon, title, description, disabled = false }: { checked: boolean; value: "household" | "community"; onChange: () => void; icon: React.ReactNode; title: string; description: string; disabled?: boolean }) {
  return <label className={["flex min-h-16 items-center gap-3 rounded-lg border p-3 transition-colors", checked ? "border-kondate-accent bg-kondate-accentSoft" : "border-kondate-line", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"].join(" ")}><input type="radio" name="visibility" value={value} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" /><span className="text-kondate-accent" aria-hidden="true">{icon}</span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-kondate-muted">{description}</span></span></label>;
}

function valueOrCurrent(value: number | undefined, current: string) {
  return value === undefined ? current : String(value);
}
