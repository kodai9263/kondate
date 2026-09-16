import { Check } from "lucide-react";
import Link from "next/link";
import { SignupForm } from "@/components/features/auth/SignupForm";
import { buildMonitorSignupHref } from "@/lib/marketing/campaignParams";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { normalizeInviteToken } from "@/lib/family/invites";
import { normalizeSignupSource } from "@/lib/marketing/signupSource";
import { getMonitorCampaignStatus } from "@/lib/marketing/monitorCampaign.server";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; invite?: string; source?: string } & Record<string, string | undefined>> }) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const { error, success, invite, source } = params;
  const checkEmail = !error && success === "check-email";
  const inviteToken = normalizeInviteToken(invite);
  const signupSource = normalizeSignupSource(source);
  const monitorStatus = signupSource === "monitor" && !checkEmail ? await getMonitorCampaignStatus() : null;
  const monitorClosed = monitorStatus ? !monitorStatus.isAvailable || !monitorStatus.isOpen : false;
  return (
    <AuthShell title={checkEmail ? "メールをご確認ください" : signupSource === "monitor" ? "無料モニター登録" : "無料で始める"} description={checkEmail ? "確認メールのリンクを開くと、利用を開始できます。" : signupSource === "monitor" ? "入力は3項目、約1分。メール認証後に14日間お試しいただけます。" : "まずは4週間の献立を試せます。カード登録は不要です。"}>
      <AuthMessage error={error} success={success} />
      {inviteToken ? <p className="mb-4 rounded-lg border border-kondate-line bg-kondate-bg p-3 text-sm text-kondate-muted">家族グループへの招待を受けて登録します。</p> : null}
      {signupSource === "monitor" && !monitorClosed && !checkEmail ? <div className="mb-5 border border-kondate-line bg-kondate-morning p-4"><p className="text-sm font-black">残り{monitorStatus?.remaining ?? 0}家庭</p><ul className="mt-2 space-y-1 text-xs leading-6 text-kondate-muted">{["家族プランの全機能を14日間無料", "カード登録なし・終了後の自動課金なし"].map((item) => <li key={item} className="flex gap-2"><Check size={15} className="mt-1 shrink-0 text-kondate-accent" aria-hidden="true" />{item}</li>)}</ul></div> : null}
      {checkEmail ? <p className="text-sm leading-7 text-kondate-muted">この画面で再登録する必要はありません。受信トレイと迷惑メールフォルダを確認し、確認メールのリンクを開いてください。</p> : monitorClosed ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg border border-kondate-line bg-kondate-bg p-4 text-sm leading-7 text-kondate-muted">{monitorStatus?.isAvailable ? "無料モニターは10家庭に達したため、受付を終了しました。" : "現在、無料モニターの受付状況を確認できません。時間をおいてもう一度お試しください。"}</p>
          <Link href="/demo/planner?source=monitor" className="inline-flex min-h-11 items-center font-semibold text-kondate-accent underline underline-offset-4">登録せずに献立デモを試す</Link>
        </div>
      ) : <SignupForm inviteToken={inviteToken} signupSource={signupSource} campaignFields={signupSource === "monitor" ? buildMonitorSignupHref(params).query : {}} />}
      <p className="mt-4 text-xs leading-6 text-kondate-faint">登録すると、<Link href="/terms" className="underline underline-offset-4 hover:text-kondate-ink">利用規約</Link>と<Link href="/privacy" className="underline underline-offset-4 hover:text-kondate-ink">プライバシーポリシー</Link>に同意したものとみなされます。</p>
      <p className="mt-5 border-t border-kondate-line pt-5 text-center text-sm text-kondate-muted">登録済みの方は <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="font-semibold text-kondate-accent underline-offset-4 hover:underline">ログイン</Link></p>
    </AuthShell>
  );
}
