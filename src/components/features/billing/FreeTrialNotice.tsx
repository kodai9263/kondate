import Link from "next/link";
import { formatTrialEnd } from "@/lib/billing/freeTrial";

export function FreeTrialNotice({ expiresAt, expired = false }: { expiresAt: string; expired?: boolean }) {
  return <aside className="my-4 rounded-lg border border-kondate-line bg-white p-4 text-sm leading-7">
    <p>{expired ? "14日間の無料体験が終了しました。保存したデータは残っています。" : `14日間無料体験中：${formatTrialEnd(expiresAt)}まで（日本時間）`}</p>
    <p className="text-xs text-kondate-muted">体験終了後の継続利用は月480円・年4,800円。カード登録なし・自動課金なし。</p>
    <Link href="/pricing" className="inline-flex min-h-11 items-center underline">継続利用のプランを見る</Link>
  </aside>;
}
