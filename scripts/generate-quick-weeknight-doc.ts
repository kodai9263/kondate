import { writeFileSync } from "node:fs";
import { scaleRecipeIngredient } from "../src/lib/family/servings";
import { quickWeeknightRecipes } from "../src/lib/nutrition/quickWeeknightRecipes";

const originalCount = 94;
const includedCount = quickWeeknightRecipes.length;
const lines = [
  `# 共働き家庭向け・平日の定番メニュー${includedCount}品`,
  "",
  "公開日：2026年9月27日。本番へ反映済み。",
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
  "- 全887件のテスト、ビルド、静的検査と一時PostgreSQLの移行検証を実施。",
  "- 本番データベースで追加15品、栄養情報15件、夕食工程105件を確認。",
  "- ログイン済みの本番画面で15品の一覧、2人分のとんかつ材料、献立の保存と再読み込み、買い物への反映を確認。確認用の献立変更は元に戻した。",
  "- PCとスマートフォン幅の表示、横はみ出し、画面エラーを確認。栄養値は献立選定用の概算で、実調理による所要時間の検証は未実施。",
  "",
  "## 公開結果",
  "",
  "[PR #63](https://github.com/kodai9263/kondate/pull/63)をmainに統合。Supabaseに追加SQLを適用し、Vercelの本番配信とログイン済み画面を確認した。",
  "",
];

writeFileSync("docs/quick-weeknight-menus-2026-09-27.md", lines.join("\n"));
