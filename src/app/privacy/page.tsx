import { LegalPage } from "@/components/features/legal/LegalPage";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <LegalPage title="プライバシーポリシー" updated="2026年11月1日">
      <p>「きょうのごはん」のWeb版・スマホアプリで取り扱う情報について説明します。</p>
      <section>
        <h2 className="text-lg font-black">取得する情報</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>メールアドレス、表示名、アカウントの識別子、家族グループと参加者の情報。</li>
          <li>家族の人数、買い物の曜日などの設定。Web版で入力したアレルギーなどの食事に関する設定。</li>
          <li>献立、買い物リスト、チェック履歴、料理の材料・作り方・写真、お気に入り、料理への評価やご意見。</li>
          <li>購入したプラン、購入・更新・有効期限・解約・返金などの契約情報、購入の検証に必要な取引識別子。</li>
          <li>お問い合わせやフィードバックの内容、対応に必要な連絡先、登録時の流入元。</li>
        </ul>
        <p className="mt-3">カード番号などのお支払い情報はAppleやStripeが管理し、本サービスでは保持しません。サービスの運用・不正利用対策のため、接続元のIPアドレスやリクエスト・エラーの記録を外部サービスが取り扱う場合があります。</p>
      </section>
      <section>
        <h2 className="text-lg font-black">利用目的と家族への共有</h2>
        <p className="mt-2">サービス提供、本人確認、家族間の情報共有、購入の検証と契約管理、不正利用の防止、お問い合わせ対応、品質改善のために利用します。</p>
        <p className="mt-2">同じ家族グループの参加者には、表示名、共有する献立・買い物・料理・家族の設定などが表示されます。招待リンクは、共有したい相手だけに送ってください。</p>
      </section>
      <section>
        <h2 className="text-lg font-black">外部サービス</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Supabase：アカウントの認証、登録確認メール、データ・料理写真の保存。</li>
          <li>Vercel：Webサイトとアプリ用サーバーの運用。</li>
          <li>Apple：iPhoneアプリの購入・復元・契約管理。購入の検証に必要な情報をAppleと本サービスの間でやり取りします。</li>
          <li>Stripe：Web版の購入と契約管理。</li>
          <li>{process.env.FEEDBACK_EMAIL_PROVIDER === "smtp" ? "Google Gmail" : "Resend"}：フィードバック通知のメール配信。</li>
        </ul>
        <p className="mt-3">各サービスには、機能の提供に必要な範囲で情報を送信します。各社の規約・プライバシーポリシーに基づき、日本国外で情報が処理される場合があります。</p>
      </section>
      <section>
        <h2 className="text-lg font-black">アクセス解析と端末への保存</h2>
        <p className="mt-2">Web版でアクセス解析を有効にしている場合は、Google Analyticsを利用し、Cookie等を通じて閲覧ページ、利用端末、参照元、操作などの利用情報を取得します。ブラウザの設定でCookieを制限できます。</p>
        <p className="mt-2">スマホアプリはログイン情報、保存済みの買い物リスト、通知設定などを端末に保存します。通知は端末上で予約し、ログアウトすると予約を解除します。圏外では共有の解除や最新の変更がすぐに反映されない場合があります。</p>
      </section>
      <section>
        <h2 className="text-lg font-black">退会と情報の削除</h2>
        <p className="mt-2">退会処理が完了すると、アカウントのログイン情報・プロフィール・本人が登録した料理写真を削除します。ほかの家族が参加している場合は共有中の献立・買い物などを残し、操作履歴の氏名との関連を外します。家族の最後の一人の場合は家族のデータも削除します。</p>
        <p className="mt-2">購入の不正な再利用を防ぐため、アカウントとの関連を外した購入識別子や、退会処理に必要な記録を保持します。決済事業者が保持する取引記録は、各社の規定に従って管理されます。退会によって定期購入が自動解約されることはありません。</p>
        <p className="mt-2">退会の受付状況、登録情報の確認・修正・削除のお問い合わせは、<Link href="/support#deletion" className="text-kondate-accent underline underline-offset-4">サポートページ</Link>をご確認ください。</p>
      </section>
    </LegalPage>
  );
}
