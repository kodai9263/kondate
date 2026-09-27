import { writeFileSync } from "node:fs";
import { scaleRecipeIngredient } from "../src/lib/family/servings";
import { quickWeeknightRecipes } from "../src/lib/nutrition/quickWeeknightRecipes";

const originalCount = 94;
const includedCount = quickWeeknightRecipes.length;
const lines = [
  `# 共働き家庭向け・平日の定番メニュー${includedCount}品`,
  "",
  "確認日：2026年9月27日。ローカル実装・検証済み。本番未反映。",
  "",
  "料理名から選びやすい家庭の定番を追加。朝の仕込みは不要。所要時間は実測前の目安で、ごはんを使う料理では炊飯時間を含まない。材料データは4人分を基準とし、以下はアプリの人数換算で2人分にした内容。",
  "",
  "| メニュー | 完成までの目安 |",
  "| --- | --- |",
  ...quickWeeknightRecipes.map((recipe) => `| ${recipe.name} | ${recipe.totalMinutes}分 |`),
  "",
  ...quickWeeknightRecipes.flatMap((recipe) => [
    `## ${recipe.name}`,
    "",
    `合わせるもの：${recipe.side}。完成まで約${recipe.totalMinutes}分。`,
    "",
    "### 材料（2人分）",
    "",
    ...recipe.ingredients.map((line) => `- ${scaleRecipeIngredient(line, 2, 4)}`),
    "",
    "### 作り方",
    "",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    ...recipe.notes.map((note) => `- ${note}`),
    "",
  ]),
  "## 実装と検証",
  "",
  `- 基準：origin/main の 28e8621。公式メニューは${originalCount}品から${originalCount + includedCount}品、40分以内の候補は56品から${56 + includedCount}品。`,
  "- 全テスト、ビルド、静的検査と一時PostgreSQLの移行検証を実施。",
  "- 栄養値は献立選定用の概算。保存先では user_estimate として扱う。実調理と本番画面での確認は未実施。",
  "",
  "## 公開時の手順",
  "",
  "追加SQLとアプリの変更を同じリリースで扱う。承認後にGitHubへpush・PR作成し、今回の移行を本番へ適用してアプリを公開する。公開後にログイン画面で一覧・詳細・献立保存と再読み込み・買い物への反映を確認する。",
  "",
  `コミットメッセージ案：\`共働き家庭向けに平日の定番メニュー${includedCount}品を追加する\``,
  "",
  `PR説明案：20〜35分で作れる家庭の定番夕食${includedCount}品を追加する。材料、人数換算、合わせ調味料、工程、公式カタログ、追加SQLをそろえた。既存レシピを更新せず、再実行しても重複しない。調理時間と栄養値は目安。`,
  "",
];

writeFileSync("docs/quick-weeknight-menus-2026-09-27.md", lines.join("\n"));
