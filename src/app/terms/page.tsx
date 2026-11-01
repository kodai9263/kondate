import { LegalPage } from "@/components/features/legal/LegalPage";
import Link from "next/link";

export default function TermsPage() {
  return (
    <LegalPage title="利用規約" updated="2026年11月1日">
      <section><h2 className="text-lg font-black">1. 適用</h2><p>本規約は、「きょうのごはん」のWeb版・スマホアプリの利用条件を定めるものです。利用者は本規約に同意したうえで本サービスを利用します。Appleを通じたアプリの利用には、<a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" className="underline underline-offset-4">Appleの標準使用許諾契約</a>も適用されます。</p></section>
      <section><h2 className="text-lg font-black">2. アカウント</h2><p>利用者は正確な情報を登録し、ログイン情報を自身の責任で管理します。第三者による不正利用を確認した場合は、速やかに運営者へ連絡してください。家族の招待リンクは、共有する相手を確認したうえで送ってください。</p></section>
      <section>
        <h2 className="text-lg font-black">3. 家族プランと定期購入</h2>
        <p>家族プランの料金、期間および提供内容は、料金ページまたはアプリの購入画面に表示します。日本での料金は月額480円または年額4,800円です。最終的な料金は購入確認画面をご確認ください。無料体験の終了だけで自動的に有料契約へ移ることはありません。</p>
        <p className="mt-2">iPhoneアプリの定期購入はApple Accountに請求されます。現在の期間が終了する24時間前までに解約しない限り自動更新されます。購入後の変更・解約はAppleのサブスクリプション管理から行ってください。Web版で購入した契約は、Web版の設定から管理できます。</p>
        <p className="mt-2">定期購入を解約しても、アカウントを維持している場合は支払い済みの利用期間が終わるまで対象機能を利用できます。アプリの削除や本サービスからの退会では、定期購入は自動解約されません。</p>
        <p className="mt-2">購入の復元には、購入時と同じApple Accountと本サービスのアカウントが必要です。退会後の再登録や別の家族への移動により、以前の購入を別のアカウント・家族へ引き継ぐことはできません。</p>
      </section>
      <section><h2 className="text-lg font-black">4. 禁止事項と登録する内容</h2><p>法令違反、不正アクセス、他者へのなりすまし、サービス運営を妨げる行為を禁止します。料理の文章・写真などを登録するときは、ご自身で作成したもの、または利用・共有する権利があるものを使用してください。</p></section>
      <section><h2 className="text-lg font-black">5. 食材・料理に関する情報</h2><p>本サービスの献立や食材情報、栄養の目安は参考情報です。アレルギー、健康状態、食材の安全性は利用者自身で確認してください。設定によってアレルゲンの完全な除去や安全性を保証するものではありません。</p></section>
      <section><h2 className="text-lg font-black">6. 退会とお問い合わせ</h2><p>退会前に、削除されるデータと家族への影響をご確認ください。退会後のデータは元に戻せません。有料契約がある場合は、先に契約元で解約してください。手続きとお問い合わせ先は<Link href="/support" className="underline underline-offset-4">サポートページ</Link>、情報の取り扱いは<Link href="/privacy" className="underline underline-offset-4">プライバシーポリシー</Link>に記載しています。</p></section>
    </LegalPage>
  );
}
