import { normalizedQuantity, parseIngredientLine, type Ingredient } from "./ingredients";

// 購入履歴に使う解析結果は変えず、買い物表示だけで表記と単位をそろえる。
const names: Record<string, string> = {
  人参: "にんじん", ニンジン: "にんじん", 玉葱: "玉ねぎ", 玉ネギ: "玉ねぎ", たまねぎ: "玉ねぎ", タマネギ: "玉ねぎ",
  ジャガイモ: "じゃがいも", 馬鈴薯: "じゃがいも", じゃが芋: "じゃがいも", 大根: "大根", だいこん: "大根", ダイコン: "大根",
  茄子: "なす", ナス: "なす", 胡瓜: "きゅうり", キュウリ: "きゅうり", 小松菜: "小松菜", こまつな: "小松菜",
  ほうれん草: "ほうれん草", ほうれんそう: "ほうれん草", ホウレンソウ: "ほうれん草",
  しめじ: "しめじ", シメジ: "しめじ", えのき茸: "えのき", えのきだけ: "えのき", エノキ: "えのき",
  生姜: "生姜", ショウガ: "生姜", にんにく: "にんにく", ニンニク: "にんにく", 大蒜: "にんにく",
  みそ: "味噌", ミソ: "味噌", 玉子: "卵", たまご: "卵", タマゴ: "卵",
};
const numeric = String.raw`(?:\d+(?:\.\d+)?|\d+/\d+)`;
const annotatedQuantity = new RegExp(`^\\(約?(${numeric})\\s*(個|コ|本|枚|丁|束|袋|パック|ml|cc|L)\\)$`);
const valueOf = (text: string) => {
  const [a, b] = text.split("/").map(Number);
  return b === undefined ? a : a / b;
};

export function purchaseIngredient(legacy: Ingredient): Ingredient & { approximate: boolean } {
  let ingredient = { ...legacy };
  let size = "";
  let approximate = false;
  // 「大1コ」「大きめ6コ」「大さじ2程度」を読み取る。範囲や代替材料は確定量にしない。
  if (legacy.amount === null && !/[〜~～→]|または|もしくは|\sor\s/.test(legacy.original)) {
    let text = legacy.original.replace(/(\d)コ/g, "$1個").replace(/cc\b/gi, "ml");
    text = text.replace(/^(.+?)\s+(大きめ|小さめ|大|中|小)\s*(?=\d)/, (_, name, qualifier) => {
      size = qualifier;
      return `${name} `;
    });
    if (/(?:程度|くらい)$/.test(text)) { text = text.replace(/(?:程度|くらい)$/, ""); approximate = true; }
    const parsed = parseIngredientLine(text);
    if (parsed.length === 1 && parsed[0].amount !== null) ingredient = { ...parsed[0], original: legacy.original };
    else { size = ""; approximate = false; }
  }
  // 「人参 大 1本」のように既存の解析でサイズが名前に入った場合も識別する。
  const sized = ingredient.name.match(/^(.+?)\s+(大きめ|小さめ|大|中|小)$/);
  if (sized && ingredient.amount !== null) { ingredient.name = sized[1]; size = sized[2]; }
  if (ingredient.amount !== null && /\s*約$/.test(ingredient.name)) {
    ingredient.name = ingredient.name.replace(/\s*約$/, "");
    approximate = true;
  }
  ingredient.name = names[ingredient.name] ?? ingredient.name;
  // 量が不明でも食材名が明確なら同じ行にまとめ、原文の量を補足として残す。
  if (ingredient.amount === null && !/または|もしくは|\sor\s/.test(ingredient.name)) {
    const unknown = ingredient.name.match(/^(.+?)\s+((?:約?\d|大さじ|小さじ|各大|各小|大\d|小\d).*)$/);
    if (unknown) {
      ingredient.name = names[unknown[1]] ?? unknown[1];
      ingredient.note = unknown[2];
    }
  }
  if (ingredient.amount !== null) {
    // 重量に明記された個数だけを採用し、食材の標準重量からは推測しない。
    const annotation = ingredient.note.match(annotatedQuantity);
    if (annotation && (ingredient.unit === "g" || ingredient.unit === "kg" || /^(ml|cc|L)$/.test(annotation[2]))) {
      const amount = valueOf(annotation[1]);
      if (Number.isFinite(amount) && amount > 0) {
        ingredient.amount = amount;
        ingredient.unit = annotation[2] === "コ" ? "個" : annotation[2] === "cc" ? "ml" : annotation[2];
        approximate = true;
        ingredient.note = "";
      }
    }
    [ingredient.amount, ingredient.unit] = normalizedQuantity(ingredient.amount, ingredient.unit);
    // 小さじ・大さじは体積なのでmlと合算できる。重量との密度換算はしない。
    if (ingredient.unit === "小さじ") { ingredient.amount *= 5; ingredient.unit = "ml"; }
  }
  if (size) ingredient.note = [ingredient.note, `${size}を含む`].filter(Boolean).join("・");
  return { ...ingredient, approximate };
}
