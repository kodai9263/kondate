import Link from "next/link";
import { getAccountDeletionStatus } from "@/lib/account/deletion";
import { retryAccountDeletion } from "@/app/account/delete/actions";

export const dynamic = "force-dynamic";

export default async function DeletionStatusPage({ searchParams }: { searchParams: Promise<{ receipt?: string }> }) {
  const { receipt } = await searchParams;
  const valid = typeof receipt === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt);
  const status = valid && process.env.ACCOUNT_DELETION_ENABLED === "true" ? await getAccountDeletionStatus(receipt) : null;
  return <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 py-8">
    <h1 className="font-mincho text-3xl font-bold">退会の状況</h1>
    {!status ? <p className="mt-6">受付番号を確認できませんでした。</p> : status.status === "completed" ?
      <p className="mt-6">アカウントの削除が完了しました。</p> : <>
        <p className="mt-6">退会を受け付け、処理を続けています。共有データへのアクセスは停止されています。</p>
        <form action={retryAccountDeletion} className="mt-5"><input type="hidden" name="receipt" value={receipt} />
          <button type="submit" className="min-h-12 rounded-lg border border-kondate-line px-5 font-bold">状況を再確認</button></form>
      </>}
    {status && <p className="mt-5 break-all text-xs text-kondate-muted">受付番号：{receipt}</p>}
    <Link href="/" className="mt-8 inline-block text-sm underline">トップへ戻る</Link>
  </main>;
}
