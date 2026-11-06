import { LegalPage } from "@/components/features/legal/LegalPage";
import { SupportContact } from "@/components/features/legal/SupportContact";
import Link from "next/link";
import type { ReactNode } from "react";

const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "公開前に設定";

const rows: Array<[string, ReactNode]> = [
  ["運営者", operatorName],
  ["販売事業者の氏名・所在地・電話番号", "請求があった場合、遅滞なく開示します。"],
  ["連絡先", <SupportContact key="contact" />],
  ["販売価格", "日本での家族プランは月額480円または年額4,800円です。料金ページと購入画面に表示し、最終的な料金は購入確認画面でご確認いただけます。"],
  ["商品代金以外の必要料金", "インターネット接続料金その他の通信料金は、利用者の負担となります。"],
  ["支払方法", "iPhoneアプリ内での購入はApple Accountに設定されたお支払い方法、Web版での購入はStripeを通じたクレジットカード決済です。"],
  ["支払時期", "申込時および以降の契約更新時に決済します。"],
  ["サービス提供時期", "決済完了後、直ちに利用できます。"],
  ["契約の更新と解約", "自動更新の定期購入です。Appleで購入した契約は期間終了の24時間前までにAppleのサブスクリプション管理から解約してください。Web版で購入した契約はWeb版の設定から管理できます。アカウントを維持している場合は、解約後も支払い済みの期間終了まで対象機能を利用できます。アプリの削除・退会では定期購入は自動解約されません。"],
  ["返品・返金", <>デジタルサービスの性質上、提供開始後の返品は受け付けていません。Appleで購入した場合の返金申請は<a href="https://support.apple.com/ja-jp/118223" className="underline underline-offset-4">Appleの窓口</a>で行います。Web版の購入は法令上必要な場合を除き、支払い済み料金の返金は行いません。お問い合わせは<Link href="/support" className="underline underline-offset-4">サポートページ</Link>をご確認ください。</>],
];

export default function CommerceLegalPage() {
  return (
    <LegalPage title="特定商取引法に基づく表記" updated="2026年11月1日">
      <dl className="divide-y divide-kondate-line">
        {rows.map(([term, detail]) => (
          <div key={term} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]">
            <dt className="font-black">{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
    </LegalPage>
  );
}
