# 実装引き継ぎ書 — 家庭向け献立管理アプリ「きょうのごはん(仮)」

**宛先: 実装担当AI(Codex) / 作成: 2026-07-31 / 発注者: 広大**

この文書は単体で読めるように書いてある。詳細仕様は同梱の `kondate-requirements.md` が唯一の正であり、本書と食い違う場合は要件定義書を優先すること。

---

## 1. プロジェクトの一言サマリ

家族5人(大人2+子ども3)が毎日使う献立管理Webアプリ。**レシピアプリではなく、家庭運営のTodoアプリ**。すべての判断基準は次の1文:

> **アプリを開いて5秒以内に「今日やること」が分かり、考える行為が一切発生しないこと。**

コアエンジンは「4週間ローテーション献立テンプレート」の自動展開:

```
menu_templates(28日×朝/夜)
  → plan_entries(実カレンダーに展開)
  → 今日のチェックリスト(recipe_stepsのphase=morning/eveningから生成)
  → 週の買い物リスト
```

ユーザーの日常操作は「チェックを付ける」「買い物リストを見る」「たまに差し替える」の3つだけ。

## 2. 同梱ファイルと役割

| ファイル | 役割 | 扱い |
|---|---|---|
| `kondate-requirements.md` | 要件定義書 v1.1(全17章+付録)。画面一覧・遷移図・**DB DDL**・API・状態管理・優先順位・季節対応(§16)・子ども評価(§17) | **仕様の正。実装前に全文を読むこと** |
| `menu-data.json` | 実データ: 朝食4パターン+夜28食(手順・調味料分量つき)+週別買い物リスト。現在は夏版(6品差し替え済み) | **シードデータの原本**(§5参照) |
| `kondate-board.html` | 動くHTMLプロトタイプ(静的・依存ゼロ) | **UI/UXリファレンス**。今日画面/週表示/買い物リストの見た目・情報密度・文言のトーンはこれに合わせる。コードの流用は不要 |
| `screen-flow.mermaid` | 画面遷移図 | 参考 |

## 3. 技術スタック(確定・変更しない)

- フロント: **Next.js(App Router)+ TypeScript + Tailwind CSS**、UI部品は shadcn/ui ベース
- バックエンド: **Supabase**(PostgreSQL + Auth + Realtime)。単純CRUDは supabase-js + RLS 直、自作APIは複合書き込み/集計のみ(要件§6)
- 状態: **TanStack Query**(サーバー状態)+ Zustand(UI状態最小限)。チェック操作は必ず楽観的更新
- その他: zod / date-fns。デプロイ: Vercel。将来PWA化前提
- 型は `supabase gen types typescript` で自動生成(手書き二重管理禁止)

アーキテクチャ原則(要件§5・§14): ページは薄く、ビジネスロジックは `lib/services/` の純関数に。献立提案は `MenuSuggester` インターフェース(要件§15)経由にし、MVPは `RotationSuggester` を実装。**AIはまだ実装しない**。

## 4. 実装スコープ

### Phase A(最初のPR群 = 要件のPhase 0+1 / P0)

1. リポジトリ初期化、Supabaseプロジェクト、CI(lint+typecheck+test)、Vercelデプロイ
2. スキーマ+RLS: 要件§3のDDLをそのまま `supabase/migrations/` に。RLSは「自分のhouseholdのみ」+「household_id IS NULLの公式データはselectのみ全員可」
3. シード投入(§5の方針で)
4. 認証(Supabase Auth: メール+Google)+ オンボーディング3ステップ(家族人数→アレルギー・苦手→テンプレ選択)。完了時にテンプレを今日から28日分展開
5. **今日画面(ホーム`/`)**: 日付+進捗、朝ごはん/調味料・分量/朝の仕込み/夜の手順の4ブロック、チェック(楽観的更新+rpc `toggle_task`)。時間帯で朝/夜セクションを自動フォーカス
6. 献立週表示(`/plans`)+ レシピ詳細(`/recipes/[id]`、人数±で分量再計算)
7. テンプレ展開API `POST /api/plans/apply-template`

### Phase B(続くPR群 = P1)

8. 買い物リスト画面(週選択・カテゴリ別・チェック・手動追加1行入力)
9. 献立差し替え(plan_entriesのrecipe_id付け替え)+「今日は無理」ボタン(楽メニュー/外食skipped/明日と交換の3択)
10. Realtime購読(`task_states`・`shopping_items`のみ)→ Queryのinvalidateに使う

### やらないこと(実装禁止・要件§8)

食材在庫管理 / 昼ごはんUI(DBのmeal_type='lunch'定義のみ) / AI提案 / 栄養計算 / 通知 / 画像・動画 / PDF / バーコード / カレンダー連携 / 本格的なレシピ編集UI(名前+手順の最小フォームまで)。評価機能(§17)はテーブル定義のみ先に作ってよいが、UIはPhase Bの後。

## 5. シードデータの変換仕様(重要・唯一のデータギャップ)

`menu-data.json` → DBへの変換スクリプト(`supabase/seed` 用)を書くこと。マッピング:

- `breakfasts.{A-D}` → recipes(category='breakfast')。`tasks[]` → recipe_steps(phase='evening'扱いではなく**朝食は全stepをphase='morning'**で登録)
- `weeks[].days[].dinner` → recipes(category='main')。同名レシピ(夏野菜カレー等)は1件に統合
- `morning[]` → recipe_steps(phase='morning'), `evening[]` → recipe_steps(phase='evening')、position順
- `prepMin/cookMin` → recipes.prep_minutes/cook_minutes、`fish`/`kids` → tags(`{'fish'}`/`{'kids'}`)
- `seasonings[]` → **recipes.meta.seasonings(jsonb, string[])に格納**して詳細画面に表示
- `breakfastRotation`+`weeks[].days[]` → menu_templates 1本 + template_entries(day_index 0-27, 日曜始まり)

**ギャップ**: `recipe_ingredients`(材料の正規化データ)は**未作成**。したがって要件§6の「材料自動集計による買い物リスト生成」はまだ動かせない。MVPでは次のフォールバックを実装する:

> `menu-data.json` の `weeks[].shopping`(人手で集計済みの週別リスト)を `menu_templates.meta.shopping`(jsonb)としてシードし、`POST /api/shopping/generate` は「その週がテンプレ第n週なら対応する静的リストをshopping_itemsへコピーする」実装にする。source='auto'。手動追加(source='manual')とチェック状態は再生成時も保持。

自動集計ロジック(名寄せ・人数換算)のインターフェースだけ `shoppingService` に切っておき、recipe_ingredients が入力され次第差し替えられる構造にすること。材料の正規化は発注者側のコンテンツ作業として後日行う。

季節対応(§16): 現データは夏版適用済みの1本なので、`seasonal_swaps` テーブルは**作成のみ・ロジック実装は不要**。

## 6. UI要求(プロトタイプ準拠)

- モバイルファースト(基準390px、max-width 560中央寄せ)。片手操作、タップ領域44px以上
- ボトムナビ4タブ固定: 今日/献立/買い物/その他。起動・復帰は常に「今日」
- 今日画面の構成・文言は `kondate-board.html` の日カードそのまま: 「朝ごはん(n分)」「調味料・分量(5人分)」「朝の仕込み(n分)」「夜の手順(n分)」。完了タスクはグレーアウト+取り消し線
- チェックのトグルは同じ行を再タップ。編集/削除メニューは出さない
- 買い物リスト: カテゴリ順は 肉→魚→野菜・果物→豆腐・卵・乳→麺・パン→冷凍・缶詰→朝ごはん定番→調味料(在庫確認)。**調味料カテゴリはデフォルト折りたたみ**
- 色は3色以内・写真なし・派手なアニメなし。「おしゃれ」より視認速度。全完了時のみ小さな祝アニメ1回
- ローディングスピナーでチェック操作をブロックしない(楽観的更新が仕様)

## 7. 受け入れ条件(Definition of Done)

Phase A完了の判定:

- [ ] 新規ユーザーがサインアップ→オンボーディング→**今日画面に献立とチェックリストが表示される**まで、空画面を一度も見ない
- [ ] 今日画面が1クエリ(ビュー`v_daily_plan`相当)で描画され、チェックのタップが体感即時(楽観的更新)、リロード後も状態が残る
- [ ] レシピ詳細で人数を5→4に変えると分量表示が即時再計算される(servings_base基準の係数計算、`lib/scaling.ts`純関数+単体テスト)
- [ ] 別アカウント(別household)のデータがRLSで一切見えないことのテストがある
- [ ] 週表示に28日分が正しい曜日で並ぶ(週の開始=日曜)
- [ ] `supabase gen types` がCIで実行され、型ズレでCIが落ちる

Phase B完了の判定:

- [ ] 買い物リストを生成→チェック→再生成しても手動追加とチェックが消えない
- [ ] 「今日は無理」から3択で差し替え/skipped/交換ができ、今日画面に即反映される
- [ ] 夫婦2端末で片方のチェックがもう片方に数秒内で反映される(Realtime)

## 8. 決定済み事項(再検討しないこと)

週の開始は日曜・買い物は土曜。5人分表示が基準(将来は子ども係数0.6で設定可能に、MVPは固定でよい)。食材在庫はやらない。買い物リストの調味料は隠す。魚は火・金(差し替え時も魚枠は魚と交換)。照りだれは共通比率(醤油3:みりん3:酒2:砂糖1)でレシピ間共有される——recipes.metaに`sauceRef:'teriyaki'`のような参照を持たせてよい。

## 9. 未決事項(実装をブロックしない。仮置きで進める)

- アプリ名: 未定。コード上は `kyou-no-gohan` を仮名とする
- 家族招待フロー: 招待コード方式(要件§3-3)の最小実装でよい。磨き込みはPhase B以降
- 食費目標: 設定に入力欄だけ用意、集計機能はなし

## 10. 進め方の指定

- PRは機能単位で小さく。各PRに「要件定義書の該当章」を明記
- スキーマ変更は必ずマイグレーションファイル。Studio手変更禁止
- 単体テストは `scaling.ts` と `planService`(テンプレ展開の日付計算)に厚く。UIテストは最小限
- 不明点・矛盾を見つけたら、勝手に仕様を変えず TODO コメント+PR説明に列挙して発注者に確認すること
