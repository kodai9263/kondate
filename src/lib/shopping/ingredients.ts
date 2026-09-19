// 材料欄を集計する。解釈できない表記は捨てず、原文と必要回数を残す。
export type Ingredient = { name: string; amount: number | null; unit: string; note: string; original: string };

const number = String.raw`(?:\d+(?:と|\s+)\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)`;
const units = "kg|ml|切れ|パック|カップ|皿分|個|本|枚|袋|缶|瓶|箱|丁|株|房|束|玉|斤|かけ|合|尾|片|cm|L|g";
const measured = new RegExp(`^(.+?)\\s*(?:各\\s*)?(?:(大さじ|小さじ)\\s*(${number})|(${number})\\s*(${units}))(.*)$`);
const aliases: Record<string, string> = {
  "しょうゆ": "醤油", "しょうが": "生姜", "こしょう": "こしょう", "胡椒": "こしょう",
  "サラダ油": "油", "鶏肉用の油": "油", "きゅうり用の塩": "塩", "衣用片栗粉": "片栗粉",
  "鶏もも": "鶏もも肉", "鶏むね": "鶏むね肉", "豚こま": "豚こま肉", "牛こま": "牛こま肉",
  "好みのドレッシング": "ドレッシング", "お好みのドレッシング": "ドレッシング",
  "温かいごはん": "ごはん（炊飯後）", "温かいご飯": "ごはん（炊飯後）", "ご飯": "ごはん（炊飯後）",
};

function parseNumber(raw: string) {
  return raw.split(/と|\s+/).reduce((sum, part) => {
    const [a, b] = part.split("/").map(Number);
    return sum + (b === undefined ? a : a / b);
  }, 0);
}

export function splitIngredientLine(line: string) {
  const text = line.normalize("NFKC").replace(/【[^】]*】/g, "").trim();
  const result: string[] = [];
  let depth = 0;
  let token = "";
  for (const char of text) {
    if (char === "(" || char === "（") depth++;
    if (char === ")" || char === "）") depth = Math.max(0, depth - 1);
    if ((char === "・" || char === "\n") && depth === 0) {
      if (token.trim()) result.push(token.trim());
      token = "";
    } else token += char;
  }
  if (token.trim()) result.push(token.trim());
  return result;
}

export function parseIngredientLine(line: string): Ingredient[] {
  return splitIngredientLine(line).flatMap((original) => {
    if (/[〜~～→]|または|もしくは|\sor\s/.test(original)) {
      return [{ name: original, amount: null, unit: "", note: "", original }];
    }
    // 括弧内の食材の条件は名前に残す。枚数に添えた重量だけは二重計上しない。
    const match = original.match(measured);
    let name = match?.[1].trim() ?? original.replace(/\s*(?:各\s*)?(?:適量|少々).*$/, "").trim();
    let amount = match ? parseNumber(match[3] ?? match[4]) : null;
    let unit = match ? match[2] ?? match[5] : "";
    let note = match?.[6].trim() ?? (name === original ? "" : original.slice(name.length).trim());
    // 「2枚（約600g）」は買い物に使える重量にそろえる。
    const weight = note.match(/^\(約?(\d+(?:\.\d+)?)(g|kg)\)$/);
    if (weight) { amount = Number(weight[1]); unit = weight[2]; note = ""; }
    // 範囲・代替・不明な後続表記を、一つの確定量として解釈しない。
    if (match && note && !/^\([^)]*\)$/.test(note)) {
      name = original; amount = null; unit = ""; note = "";
    }
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      name = original; amount = null; unit = ""; note = "";
    }
    const names = name.includes("/") && /各|少々|適量/.test(original) ? name.split("/") : [name];
    return names.map((part) => ({ name: (aliases[part.trim()] ?? part.trim()).replace(/\(/g, "（").replace(/\)/g, "）"), amount, unit, note, original }));
  });
}

export function normalizedQuantity(amount: number, unit: string): [number, string] {
  if (unit === "kg") return [amount * 1000, "g"];
  if (unit === "L") return [amount * 1000, "ml"];
  if (unit === "大さじ") return [amount * 3, "小さじ"];
  return [amount, unit];
}

export function formatIngredientAmount(amount: number, unit: string) {
  // 浮動小数点誤差だけを除き、必要量は切り下げない。
  const value = Math.ceil((amount - 1e-9) * 100) / 100;
  if (unit === "小さじ") {
    if (value < 3) return `小さじ${value}`;
    const tablespoons = Math.floor(value / 3);
    const remaining = Number((value - tablespoons * 3).toFixed(2));
    return `大さじ${tablespoons}${remaining ? `＋小さじ${remaining}` : ""}`;
  }
  return `${value}${unit}`;
}

export function ingredientCategory(name: string) {
  if (/^(水|氷)$/.test(name)) return "水・氷（調理用）";
  if (/豆腐|厚揚げ|油揚げ|卵|牛乳|豆乳|バター|チーズ|ヨーグルト|納豆/.test(name)) return "豆腐・卵・乳";
  if (/醤油|みりん|酒|砂糖|塩|こしょう|胡椒|味噌|酢|油|だし|コンソメ|スープの素|鶏がら|ソース|たれ|ポン酢|ケチャップ|マヨネーズ|ドレッシング|ごま|豆板醤|甜麺醤|カレー粉|ルウ|ルー|マスタード|片栗粉|薄力粉|小麦粉|パン粉|乾燥パセリ|唐辛子/.test(name)) return "調味料(在庫確認)";
  if (/肉|鶏|豚|牛|ハム|ウインナー|手羽|レバー/.test(name)) return "肉";
  if (/鮭|さば|たら|あじ|いわし|ぶり|さわら|まぐろ|かつお(?!節)|さんま|かじき|魚|えび|あさり|牡蠣|うなぎ|しらす/.test(name)) return "魚";
  if (/米|ごはん|麺|うどん|そうめん|スパゲ|マカロニ|パン|シリアル|餃子の皮/.test(name)) return "米・麺・パン";
  if (/缶|水煮|ビーンズ|冷凍|乾燥|のり|わかめ|かつお節|昆布|紅生姜|クリームコーン|カットトマト/.test(name)) return "冷凍・缶詰・乾物";
  return "野菜・その他";
}
