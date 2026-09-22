export type SeasoningGroup = { id: string; name: string; ingredients: string[] };

/** 材料に明記された記号だけを使う。油や仕上げの調味料を推測でまとめない。 */
export function parseSeasoningLine(line: string) {
  const match = line.match(/^【((?:副菜)?[A-ZＡ-Ｚ])\s*[:：]\s*([^】]+)】\s*(.+)$/);
  if (!match) return null;
  return { id: match[1].normalize("NFKC"), name: match[2].trim(), content: match[3].trim() };
}

export function getSeasoningGroups(ingredients: string[]): SeasoningGroup[] {
  const groups = new Map<string, SeasoningGroup>();
  const conflicting = new Set<string>();
  for (const line of ingredients) {
    const parsed = parseSeasoningLine(line);
    if (!parsed) continue;
    const previous = groups.get(parsed.id);
    if (previous && previous.name !== parsed.name) conflicting.add(parsed.id);
    else if (previous) previous.ingredients.push(parsed.content);
    else groups.set(parsed.id, { id: parsed.id, name: parsed.name, ingredients: [parsed.content] });
  }
  // 同じ記号が異なる料理を指す場合は、誤った分量を工程へ補足しない。
  return [...groups.values()].filter((group) => !conflicting.has(group.id));
}

export function getStepSeasoningIds(step: string): string[] {
  return [...new Set([...step.normalize("NFKC").matchAll(/(?<![A-Za-z0-9菜°])((?:副菜)?[A-Z])(?=\s*(?:[()【】をのとにで、・]|\]|$))/g)].map((match) => match[1]))];
}

/** 自作副菜のAと主菜のAを別の記号として表示する。保存原文は変えない。 */
export function scopeSideSeasonings(ingredients: string[], steps: string[]) {
  const ids = new Set(getSeasoningGroups(ingredients).map((group) => group.id).filter((id) => /^[A-Z]$/.test(id)));
  return {
    ingredients: ingredients.map((line) => line.replace(/^【([A-ZＡ-Ｚ])(?=\s*[:：])/, (match, id: string) => ids.has(id.normalize("NFKC")) ? `【副菜${id}` : match)),
    steps: steps.map((step) => step.replace(/(?<![A-Za-z0-9菜°])([A-ZＡ-Ｚ])(?=\s*(?:[（）()【】をのとにで、・]|\]|$))/g, (id) => ids.has(id.normalize("NFKC")) ? `副菜${id}` : id)),
  };
}

export function getStepSeasoningGroups(step: string, groups: SeasoningGroup[]) {
  const ids = new Set(getStepSeasoningIds(step));
  return groups.filter((group) => ids.has(group.id));
}
