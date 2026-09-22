import Link from "next/link";
import { SignupForm } from "@/components/features/auth/SignupForm";
import { getCampaignFields } from "@/lib/marketing/campaignParams";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { normalizeInviteToken } from "@/lib/family/invites";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; invite?: string; source?: string } & Record<string, string | undefined>> }) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const { error, success, invite } = params;
  const checkEmail = !error && success === "check-email";
  const inviteToken = normalizeInviteToken(invite);
  // 古い募集URLも通常登録に統一し、キャンペーンの残枠には依存させない。
  const displayError = error === "monitor-full" || error === "monitor-unavailable" ? undefined : error;
  return (
    <AuthShell title={checkEmail ? "メールをご確認ください" : "無料で始める"} description={checkEmail ? "確認メールのリンクを開くと、利用を開始できます。" : "まずは4週間の献立を試せます。カード登録は不要です。"}>
      <AuthMessage error={displayError} success={success} />
      {inviteToken ? <p className="mb-4 rounded-lg border border-kondate-line bg-kondate-bg p-3 text-sm text-kondate-muted">家族グループへの招待を受けて登録します。</p> : null}
      {checkEmail ? <p className="text-sm leading-7 text-kondate-muted">この画面で再登録する必要はありません。受信トレイと迷惑メールフォルダを確認し、確認メールのリンクを開いてください。</p> : <SignupForm inviteToken={inviteToken} campaignFields={getCampaignFields(params)} />}
      <p className="mt-4 text-xs leading-6 text-kondate-faint">登録すると、<Link href="/terms" className="underline underline-offset-4 hover:text-kondate-ink">利用規約</Link>と<Link href="/privacy" className="underline underline-offset-4 hover:text-kondate-ink">プライバシーポリシー</Link>に同意したものとみなされます。</p>
      <p className="mt-5 border-t border-kondate-line pt-5 text-center text-sm text-kondate-muted">登録済みの方は <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="font-semibold text-kondate-accent underline-offset-4 hover:underline">ログイン</Link></p>
    </AuthShell>
  );
}
