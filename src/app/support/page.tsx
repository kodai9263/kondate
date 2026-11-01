import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/features/legal/LegalPage";
import { SupportContact } from "@/components/features/legal/SupportContact";

export const metadata: Metadata = {
  title: "サポート・お問い合わせ",
  description: "きょうのごはんのログイン、家族プラン、購入の復元、解約、退会についてのご案内とお問い合わせ窓口です。",
};

const linkClass = "text-kondate-accent underline underline-offset-4";

export default function SupportPage() {
  const deletionEnabled = process.env.ACCOUNT_DELETION_ENABLED === "true";

  return (
    <LegalPage title="サポート・お問い合わせ" updated="2026年11月1日">
      <p>「きょうのごはん」の使い方や、お困りのことをご案内します。このページはログインせずに確認できます。</p>
      <nav aria-label="サポートの項目" className="flex flex-wrap gap-x-5 gap-y-1 border-y border-kondate-line py-3">
        {[["contact", "お問い合わせ"], ["login", "ログイン"], ["billing", "購入・解約"], ["deletion", "退会"], ["shopping", "買い物・通知"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className={`inline-flex min-h-11 items-center ${linkClass}`}>{label}</a>
        ))}
      </nav>
      <section id="contact" className="scroll-mt-6">
        <h2 className="text-lg font-black">お問い合わせ</h2>
        <p className="mt-2">不具合のご相談や、改善してほしいことはこちらへお送りください。</p>
        <SupportContact />
        <p className="mt-2">お使いの端末、アプリのバージョン、起きたこと、表示されたメッセージを添えると確認がスムーズです。パスワード、確認コード、カード番号は送らないでください。</p>
        <p className="mt-2">Web版では、<Link href="/account" className={linkClass}>設定の「アプリへのご意見」</Link>からも送れます。</p>
      </section>
      <section id="login" className="scroll-mt-6">
        <h2 className="text-lg font-black">登録・ログイン</h2>
        <h3 className="mt-4 font-bold">確認メールを開いた後は？</h3>
        <p>メールの案内に沿って確認を済ませ、iPhoneアプリに戻って登録したメールアドレスとパスワードでログインしてください。メールを開いたブラウザでログインする必要はありません。</p>
        <h3 className="mt-4 font-bold">確認リンクを使えないと表示されたら？</h3>
        <p>すでに確認が済んでいる場合もあります。まずアプリでログインをお試しください。メールの確認が必要と表示された場合は、アプリの「確認メールを再送」から最新のメールを受け取ってください。再登録は不要です。</p>
        <h3 className="mt-4 font-bold">パスワードを忘れたとき</h3>
        <p>アプリのログイン画面で「パスワードを忘れた」を開き、登録済みのメールアドレスを入力してください。届いたメールから新しいパスワードを設定できます。</p>
      </section>
      <section id="billing" className="scroll-mt-6">
        <h2 className="text-lg font-black">家族プラン・購入の復元・解約</h2>
        <p className="mt-2">日本での家族プランは月額480円または年額4,800円です。iPhoneアプリでの購入は自動更新の定期購入です。購入前にAppleの確認画面で料金と期間をご確認ください。</p>
        <h3 className="mt-4 font-bold">購入済みなのに無料プランと表示されるとき</h3>
        <p>購入時と同じApple Accountと、「きょうのごはん」のアカウントでログインし、通信できる状態でアプリの「設定」→「家族プラン」→「購入を復元」を押してください。別のアカウント・家族の購入は引き継げません。</p>
        <p className="mt-2">退会後に同じメールアドレスで登録しても、以前のアカウントや購入は復元されません。解決しない場合は追加購入せず、お問い合わせください。</p>
        <h3 className="mt-4 font-bold">iPhoneアプリで購入した契約を解約する</h3>
        <p>アプリの「設定」→「家族プラン」→「Appleの契約を管理」から手続きできます。iPhoneの「設定」→ご自身の名前→「サブスクリプション」からも確認できます。</p>
        <p className="mt-2"><a href="https://apps.apple.com/account/subscriptions/" className={linkClass}>Appleのサブスクリプション管理を開く</a></p>
        <p className="mt-2">アプリの削除や退会だけでは定期購入は解約されません。退会前に契約元で解約してください。返金の申請は<a href="https://support.apple.com/ja-jp/118223" className={linkClass}>Appleの返金手続き</a>をご確認ください。</p>
        <h3 className="mt-4 font-bold">Web版で購入した契約</h3>
        <p>Web版の<Link href="/account" className={linkClass}>「設定」→「契約」</Link>から管理してください。Appleで購入した契約とは管理する場所が異なります。</p>
      </section>
      <section id="deletion" className="scroll-mt-6">
        <h2 className="text-lg font-black">退会・データの削除</h2>
        {deletionEnabled ? (
          <p className="mt-2">アプリの「設定」→「退会」から、削除される内容を確認して手続きできます。Web版は<Link href="/account/delete" className={linkClass}>アカウントの削除</Link>を開いてください。</p>
        ) : (
          <p className="mt-2">アプリ内の退会受付は準備中です。アカウントや登録情報の削除については、上のお問い合わせ窓口へご連絡ください。</p>
        )}
        <p className="mt-2">退会処理が完了すると、ログイン情報・プロフィール・本人が登録した写真を削除します。ほかの家族がいる場合は共有中の献立・買い物を残し、家族の最後の一人の場合は家族のデータも削除します。</p>
        <p className="mt-2">削除後は元に戻せません。家族プランを契約している場合は、先に契約元で定期購入を解約してください。</p>
      </section>
      <section id="shopping" className="scroll-mt-6">
        <h2 className="text-lg font-black">買い物リスト・通知</h2>
        <h3 className="mt-4 font-bold">通信できない場所で買い物リストを見る</h3>
        <p>通信できる場所で一度リストを開いておくと、保存済みのリストを取得時刻付きで確認できます。通信できない間は編集できません。通信を戻して「最新のリストを確認」を押すと、最新の内容に更新できます。</p>
        <h3 className="mt-4 font-bold">通知が届かないとき</h3>
        <p>アプリの「設定」で「買い物」または「仕込み」をONにし、曜日・時刻を選んで「通知設定を保存」を押してください。iPhone側でも通知を許可してください。通知は設定した端末で届き、ログアウトすると予約が解除されます。</p>
      </section>
      <p className="border-t border-kondate-line pt-5"><Link href="/terms" className={linkClass}>利用規約</Link> · <Link href="/privacy" className={linkClass}>プライバシーポリシー</Link> · <Link href="/legal" className={linkClass}>特定商取引法に基づく表記</Link></p>
    </LegalPage>
  );
}
