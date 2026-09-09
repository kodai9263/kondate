import Link from "next/link";
import { signup } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { normalizeInviteToken } from "@/lib/family/invites";
import { normalizeSignupSource } from "@/lib/marketing/signupSource";
import { getMonitorCampaignStatus } from "@/lib/marketing/monitorCampaign.server";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; invite?: string; source?: string }> }) {
  await redirectIfAuthenticated();
  const { error, success, invite, source } = await searchParams;
  const inviteToken = normalizeInviteToken(invite);
  const signupSource = normalizeSignupSource(source);
  const monitorStatus = signupSource === "monitor" ? await getMonitorCampaignStatus() : null;
  const monitorClosed = monitorStatus ? !monitorStatus.isAvailable || !monitorStatus.isOpen : false;
  return (
    <AuthShell title={signupSource === "monitor" ? "無料モニターに参加" : "無料で始める"} description={signupSource === "monitor" ? "14日間、家族プランの全機能を無料で試せます。カード登録は不要です。" : "まずは4週間の献立を試せます。カード登録は不要です。"}>
      <AuthMessage error={error} success={success} />
      {inviteToken ? <p className="mb-4 rounded-lg border border-kondate-line bg-kondate-bg p-3 text-sm text-kondate-muted">家族グループへの招待を受けて登録します。</p> : null}
      {monitorClosed ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg border border-kondate-line bg-kondate-bg p-4 text-sm leading-7 text-kondate-muted">{monitorStatus?.isAvailable ? "無料モニターは10家庭に達したため、受付を終了しました。" : "現在、無料モニターの受付状況を確認できません。時間をおいてもう一度お試しください。"}</p>
          <Link href="/demo/planner?source=monitor" className="inline-flex min-h-11 items-center font-semibold text-kondate-accent underline underline-offset-4">登録せずに献立デモを試す</Link>
        </div>
      ) : <form action={signup} className="space-y-4">
        {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
        {signupSource ? <input type="hidden" name="signupSource" value={signupSource} /> : null}
        <AuthField id="displayName" label="お名前" autoComplete="name" />
        <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
        <AuthField id="password" label="パスワード" type="password" autoComplete="new-password" helper="8文字以上で設定してください。" />
        <AuthSubmit>{signupSource === "monitor" ? "14日間の無料モニターを始める" : "無料アカウントを作る"}</AuthSubmit>
      </form>}
      <p className="mt-4 text-xs leading-6 text-kondate-faint">登録すると、<Link href="/terms" className="underline underline-offset-4 hover:text-kondate-ink">利用規約</Link>と<Link href="/privacy" className="underline underline-offset-4 hover:text-kondate-ink">プライバシーポリシー</Link>に同意したものとみなされます。</p>
      <p className="mt-5 border-t border-kondate-line pt-5 text-center text-sm text-kondate-muted">登録済みの方は <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="font-semibold text-kondate-accent underline-offset-4 hover:underline">ログイン</Link></p>
    </AuthShell>
  );
}
