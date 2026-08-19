import { LegalPage } from "@/components/features/legal/LegalPage";

const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "公開前に設定";
const contact = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "公開前に設定";

const rows = [
  ["運営者", operatorName],
  ["販売事業者の氏名・所在地・電話番号", "請求があった場合、遅滞なく開示します。"],
  ["連絡先", contact],
  ["販売価格", "料金ページに表示します。"],
  ["商品代金以外の必要料金", "インターネット接続料金その他の通信料金は、利用者の負担となります。"],
  ["支払方法", "クレジットカード決済"],
  ["支払時期", "申込時および以降の契約更新時に決済します。"],
  ["サービス提供時期", "決済完了後、直ちに利用できます。"],
  ["解約", "アカウント画面からいつでも手続きできます。解約後も、支払い済みの利用期間が終わるまで対象機能を利用できます。"],
  ["返品・返金", "デジタルサービスの性質上、提供開始後の返品は受け付けていません。法令上必要な場合を除き、支払い済み料金の返金は行いません。"],
];

export default function CommerceLegalPage() {
  return (
    <LegalPage title="特定商取引法に基づく表記">
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
