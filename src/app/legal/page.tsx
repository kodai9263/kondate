import { LegalPage } from "@/components/features/legal/LegalPage";

const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "公開前に設定";
const contact = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "公開前に設定";

export default function CommerceLegalPage() { const rows = [["販売事業者", operatorName], ["連絡先", contact], ["販売価格", "料金ページに表示"], ["商品代金以外の必要料金", "インターネット接続料金その他の通信料金"], ["支払方法", "クレジットカード決済"], ["支払時期", "申込時および以降の契約更新時"], ["サービス提供時期", "決済完了後、直ちに利用可能"], ["解約", "アカウント画面からいつでも手続き可能。支払い済み期間の返金は行いません。"]]; return <LegalPage title="特定商取引法に基づく表記"><p className="rounded-lg bg-kondate-morning p-3 font-bold">販売開始前に、販売事業者名・住所・電話番号・連絡先と返金条件の法務確認が必要です。</p><dl className="divide-y divide-kondate-line">{rows.map(([term, detail]) => <div key={term} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="font-black">{term}</dt><dd>{detail}</dd></div>)}</dl></LegalPage>; }
