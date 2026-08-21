# きょうのごはん

家庭向け献立管理アプリの初期実装です。詳細仕様は [kondate-requirements.md](/Users/yabekoudai/Documents/家庭向け献立管理アプリ/kondate-requirements.md)、引き継ぎは [HANDOFF.md](/Users/yabekoudai/Documents/家庭向け献立管理アプリ/HANDOFF.md) を正とします。

## 開発コマンド

```bash
npm install
npm run dev
npm run typecheck
npm run test
```

## ドメイン用語

- `menu_templates`: 28日分の公式ローテーション献立
- `template_entries`: テンプレート内の「day_index + meal_type + recipe」
- `plan_entries`: 実カレンダーへ展開された献立
- `recipe_steps`: 朝の仕込み・夜の手順・朝食タスク
- `task_states`: チェック済み状態。行があることが完了を意味する
- `shopping_items`: 週単位の買い物リスト。`source='manual'` は再生成でも保持する

## 現在の範囲

- ZIP同梱の公式データをUIとシード変換の原本として配置
- モバイルファーストの今日/献立/買い物の静的プレビュー
- Supabase DDL/RLS/RPC/ビューの初期マイグレーション
- 人数換算、日曜始まりのテンプレ展開、静的買い物リスト生成の純関数
- 栄養値、主なたんぱく源、調理時間、重複を考慮した月間献立生成
- 日ごとの献立固定と、固定日以外の再生成
- マイメニュー、栄養目安、料理写真の家庭単位保存
- 期限付き招待リンクによる家族グループ参加

Supabase Authのログイン・新規登録・パスワード再設定と、登録時の家族グループ自動作成を実装済みです。公開環境では、Supabaseの認証URLとVercelの環境変数を公開URLに合わせて設定します。

## 画面構成

- `/`: 販売用LP
- `/signup`, `/login`: 新規登録・ログイン
- `/forgot-password`, `/reset-password`: パスワード再設定
- `/app`: ログイン後の献立アプリ
- `/app/planner`: 栄養バランス付き月間献立
- `/app/recipes`, `/app/recipes/new`: メニュー一覧と登録
- `/demo/planner`: 登録前に試せる月間献立デモ
- `/account`: プロフィール、家族グループ、契約管理
- `/pricing`: 無料版・家族プランの比較と申込み
- `/terms`, `/privacy`, `/legal`: 利用規約、プライバシーポリシー、特定商取引法に基づく表記

## 課金設計

課金は Stripe Checkout + Customer Portal を使います。カード情報・解約・支払い方法変更は Stripe hosted UI に任せ、アプリ側は `household_subscriptions` に household 単位の購読状態だけを保持します。

- 無料: 4週間テンプレート1本、今日画面、献立/買い物プレビュー
- 家族プラン: 月480円想定。家族共有、買い物同期、チェック保存、季節テンプレート、子ども評価
- 年払い: 年4,800円想定

必要な環境変数は [.env.example](/Users/yabekoudai/Documents/家庭向け献立管理アプリ/.env.example) を参照してください。

### Stripe連携の流れ

1. Stripe Dashboardで月額/年額のPriceを作成
2. `STRIPE_PRICE_FAMILY_MONTHLY` / `STRIPE_PRICE_FAMILY_YEARLY` にPrice IDを設定
3. `/api/billing/checkout` でCheckout Sessionを作成
4. `/api/stripe/webhook` で `checkout.session.completed` と `customer.subscription.*` を受信
5. `/api/billing/portal` からCustomer Portalへ遷移

本番公開、商品作成、Webhook endpoint登録は外部操作なので、実行前に明示確認が必要です。

### 有料機能の切り方

`src/lib/billing/entitlements.ts` で購読状態から有料機能の有効/無効を判定します。現時点の有料機能キーは次の5つです。

- `family_sharing`
- `shopping_sync`
- `persisted_task_checks`
- `seasonal_templates`
- `child_feedback`
