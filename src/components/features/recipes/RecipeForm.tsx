import { createRecipe } from "@/app/app/recipes/new/actions";
import { PendingButton } from "@/components/ui/PendingButton";

const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 py-2 text-base font-normal focus:border-kondate-accent";
export function RecipeForm() {
  return <form action={createRecipe} className="mt-6 space-y-5">
    <p className="text-sm leading-7 text-kondate-muted">わが家の料理を保存できます。ご自身で書いた材料と作り方を入力してください。</p>
    <label className="block text-sm font-semibold">料理名（必須）<input className={inputClass} name="name" required maxLength={80} /></label>
    <label className="block text-sm font-semibold">副菜・汁物<input className={inputClass} name="side" maxLength={120} /></label>
    <div className="grid grid-cols-2 gap-4">
      <label className="text-sm font-semibold">何人分（必須）<input className={inputClass} name="servings" type="number" min={1} max={20} required defaultValue={4} /></label>
      <label className="text-sm font-semibold">完成までの時間（分）<input className={inputClass} name="cookMinutes" type="number" min={1} max={240} required defaultValue={25} /></label>
    </div>
    <label className="block text-sm font-semibold">主なたんぱく源<select className={inputClass} name="proteinSource" defaultValue="meat"><option value="fish">魚</option><option value="meat">肉</option><option value="soy">大豆・豆腐</option><option value="egg">卵</option><option value="noodle">麺・その他</option></select></label>
    <label className="block text-sm font-semibold">材料（必須）<textarea className={inputClass} rows={6} name="ingredients" required maxLength={4000} placeholder="1行に1つ、食材と分量を入力" /></label>
    <label className="block text-sm font-semibold">作り方（必須）<textarea className={inputClass} rows={8} name="steps" required maxLength={4000} placeholder="1行に1つの手順を入力" /></label>
    <PendingButton>わが家のメニューに保存</PendingButton>
  </form>;
}
