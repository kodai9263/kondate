import { getStepSeasoningGroups, parseSeasoningLine, type SeasoningGroup } from "@/lib/recipes/seasoningGroups";

export function RecipeIngredientLine({ text }: { text: string }) {
  const group = parseSeasoningLine(text);
  if (!group) return <>{text}</>;
  return <span className="block rounded bg-kondate-accentSoft/50 p-3">
    <span className="mb-1 flex items-start gap-2 font-semibold text-kondate-accent">
      <span className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded bg-kondate-accent px-1 text-sm text-white">{group.id}</span>
      <span>{group.name}</span>
    </span>
    {group.content.split("・").map((item, index) => <span key={index} className="block text-kondate-ink">{item}</span>)}
  </span>;
}

export function StepSeasoningGuide({ step, groups }: { step: string; groups: SeasoningGroup[] }) {
  const referenced = getStepSeasoningGroups(step, groups);
  if (!referenced.length) return null;
  return <span className="mt-3 block space-y-2 text-sm leading-6">
    {referenced.map((group) => <span key={group.id} className="block rounded bg-kondate-accentSoft/50 px-3 py-2 text-kondate-ink">
      <span className="block font-semibold text-kondate-accent">{group.id}：{group.name}</span>
      <span className="block text-xs text-kondate-muted">材料欄の全量です。使う量・タイミングは上の工程に従ってください。</span>
      {group.ingredients.flatMap((line) => line.split("・")).map((item, index) => <span key={index} className="block">{item}</span>)}
    </span>)}
  </span>;
}
