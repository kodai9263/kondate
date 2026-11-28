/** 材料欄の事実情報だけを読む。サイトの取得・許可判定・保存は行わない。 */
export type IngredientFact = { name: string; amount: string; group: string | null };

export function readKikkomanIngredients(html: string): IngredientFact[] {
  if (html.length > 2_000_000) throw new Error("ingredient_page_too_large");
  const start = html.search(/<div\s+class=["']recipe-detail-ingredient["']/);
  if (start < 0) throw new Error("ingredients_not_found");
  const end = html.indexOf("</section>", start);
  if (end < 0) throw new Error("ingredients_not_found");
  const section = html.slice(start, end);
  const tokens = section.matchAll(/<div\s+class=["']recipe-detail-ingredient__heading__title["'][^>]*>([\s\S]*?)<\/div>|<li\b[^>]*>([\s\S]*?)<\/li>/g);
  const ingredients: IngredientFact[] = [];
  let group: string | null = null;
  for (const match of tokens) {
    if (match[1] !== undefined) {
      group = plainText(match[1]);
      if (!group || group.length > 80) throw new Error("invalid_ingredient_group");
      continue;
    }
    const row = match[2];
    const name = row.match(/<div\s+class=["']recipe-detail-ingredient__name["'][^>]*>([\s\S]*?)<\/div>/)?.[1];
    const amount = row.match(/<div\s+class=["']recipe-detail-ingredient__portion["'][^>]*>([\s\S]*?)<\/div>/)?.[1];
    // 一部だけ欠けた材料表を成功として返さない。
    if (name === undefined || amount === undefined) throw new Error("incomplete_ingredient");
    const fact = { name: plainText(name), amount: plainText(amount), group };
    if (!fact.name || !fact.amount || fact.name.length > 150 || fact.amount.length > 100) throw new Error("invalid_ingredient");
    ingredients.push(fact);
    if (ingredients.length > 100) throw new Error("too_many_ingredients");
  }
  if (!ingredients.length) throw new Error("ingredients_not_found");
  return ingredients;
}

function plainText(value: string): string {
  // 外部の画像・スクリプト・埋め込みは出力しない。
  if (/<\s*(?:script|style|iframe|img)\b/i.test(value)) throw new Error("unexpected_ingredient_markup");
  const text = value.replace(/<[^>]*>/g, "");
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " };
    if (named[entity.toLowerCase()] !== undefined) return named[entity.toLowerCase()];
    const hex = entity[2].toLowerCase() === "x";
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    if (code < 32 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new Error("invalid_ingredient_character");
    return String.fromCodePoint(code);
  }).replace(/\s+/g, " ").trim();
}

/** 範囲表記や個数を勝手に人数へ変換しない。 */
export function readRecipeServings(value: string): { label: string; count: number | null } {
  const label = value.normalize("NFKC").trim();
  const match = label.match(/^(\d+)\s*(?:人分|人前|servings?)?$/i);
  const count = match ? Number(match[1]) : 0;
  return { label, count: count >= 1 && count <= 20 ? count : null };
}
