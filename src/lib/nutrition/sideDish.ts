import type { PlannedDinner, SideDish, SideMode } from "@/types/nutrition";

const sideSectionPattern = /味噌汁|すまし汁|スープ|ナムル|付け合わせ|ごま和え|おひたし|浅漬け|サラダ|冷ややっこ|酢の物|甘酢|白和え|和え物|和え衣|きんぴら|かきたま汁/;

export function resolveDinnerIngredients(day: PlannedDinner) {
  const mode = day.sideMode ?? "default";
  if (mode === "default") return day.recipe.ingredientsText;
  return replaceSideIngredients(day.recipe.ingredientsText, day.recipe.side, mode, day.sideDish ?? null);
}

export function resolveDinnerSteps(day: PlannedDinner) {
  const mode = day.sideMode ?? "default";
  if (mode === "default") return day.recipe.eveningSteps;
  return removeDefaultSideSteps(day.recipe.eveningSteps ?? [], day.recipe.ingredientsText, day.recipe.side);
}

export function replaceSideIngredients(
  ingredientsText: string | undefined,
  defaultSideName: string,
  mode: SideMode,
  sideDish: SideDish | null,
) {
  const mainIngredients = (ingredientsText ?? "")
    .split(/\r?\n/)
    .filter((line) => !isDefaultSideIngredientLine(line, defaultSideName));
  const customIngredients = mode === "custom" && sideDish?.ingredientsText.trim()
    ? sideDish.ingredientsText.trim().split(/\r?\n/)
    : [];
  const combined = [...mainIngredients, ...customIngredients].filter((line) => line.trim());
  return combined.length > 0 ? combined.join("\n") : undefined;
}

function isDefaultSideIngredientLine(line: string, sideName: string) {
  const label = line.match(/^【([^】]+)】/)?.[1];
  if (!label) return false;
  if (sideSectionPattern.test(label)) return true;
  if (/ご飯|ごはん|炊き込み|混ぜご飯/.test(sideName) && /豆ご飯|ご飯|主食|炊き込み|混ぜご飯|炊飯用/.test(label)) return true;
  if (/煮/.test(sideName) && /煮物|とろみ/.test(label)) return true;
  if (/和え/.test(sideName) && /和え衣/.test(label)) return true;
  if (/酢|漬け/.test(sideName) && /甘酢|サラダだれ/.test(label)) return true;
  return false;
}

export function removeDefaultSideSteps(steps: string[], ingredientsText: string | undefined, sideName: string) {
  const lines = (ingredientsText ?? "").split(/\r?\n/);
  const sideLines = lines.filter((line) => isDefaultSideIngredientLine(line, sideName));
  const mainLines = lines.filter((line) => !isDefaultSideIngredientLine(line, sideName));
  const sideLabels = sideLines.flatMap((line) => line.match(/^【([^】]+)】/)?.[1] ?? []);
  const sideTerms = ingredientTerms(sideLines);
  const mainTerms = ingredientTerms(mainLines);
  const riceSide = /ご飯|ごはん|炊き込み|混ぜご飯/.test(sideName);

  return steps.flatMap((step) => {
    const kept = step.split(/(?<=。)/).filter((sentence) => {
      if (sideLabels.some((label) => label.length >= 2 && sentence.includes(label))) return false;
      if (riceSide && /炊飯|ご飯|ごはん|米を|米・/.test(sentence)) return false;
      const hasSideTerm = sideTerms.some((term) => sentence.includes(term));
      const hasMainTerm = mainTerms.some((term) => sentence.includes(term));
      return !hasSideTerm || hasMainTerm;
    }).join("").trim();
    return kept ? [kept] : [];
  });
}

function ingredientTerms(lines: string[]) {
  const common = /^(水|塩|油|酒|砂糖|醤油|しょうゆ|味噌|みりん|酢|だし|顆粒だし|こしょう|塩こしょう|片栗粉)$/;
  const terms = lines.flatMap((line) => line.replace(/^【[^】]+】/, "").split("・").flatMap((part) => part.split("/")))
    .map((part) => part.trim().replace(/\s+(?:約)?\d.*$/, "").replace(/\s+(?:各)?(?:小さじ|大さじ|少々|適量).*$/, ""))
    .filter((term) => term.length >= 2 && !common.test(term));
  return [...new Set(terms)];
}
