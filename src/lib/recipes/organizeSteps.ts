/** 工程の順番・数値・条件を変えず、貼り付けた文章の改行を整える。 */
export function organizeSteps(value: string): string {
  if (!value.trim() || value.length > 4000) throw new Error("作り方を1〜4,000文字で入力してください。");
  const lines = value.replace(/\r\n?/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  // 工程番号への参照がある文章は分割しない。元の対応関係を保つ。
  const numbered = /(?:^|\n)\s*(?:\d+[.．、）)]|[①-⑳])|[（(]\d+[）)]|手順\s*\d/.test(value);
  const organized = (lines.length === 1 && !numbered ? lines[0].split(/(?<=。)(?![」』）)])/u) : lines)
    .map(line => line.trim()).filter(Boolean).join("\n");
  if (organized.length > 4000) throw new Error("整理後の作り方が4,000文字を超えます。内容を確認してください。");
  return organized;
}
