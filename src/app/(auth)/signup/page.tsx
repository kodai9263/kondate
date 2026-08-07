import Link from "next/link";
import { signup } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { normalizeInviteToken } from "@/lib/family/invites";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; invite?: string }> }) {
  await redirectIfAuthenticated();
  const { error, success, invite } = await searchParams;
  const inviteToken = normalizeInviteToken(invite);
  return (
    <AuthShell title="無料で始める" description="まずは4週間の献立を試せます。カード登録は不要です。">
      <AuthMessage error={error} success={success} />
      {inviteToken ? <p className="mb-4 rounded-lg border border-kondate-line bg-white p-3 text-sm font-bold text-kondate-ink">家族グループへの招待を受けて登録します。</p> : null}
      <form action={signup} className="space-y-4">
        {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
        <AuthField id="displayName" label="お名前" autoComplete="name" />
        <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
        <AuthField id="password" label="パスワード" type="password" autoComplete="new-password" helper="8文字以上で設定してください。" />
        <AuthSubmit>無料アカウントを作る</AuthSubmit>
      </form>
      <p className="mt-4 text-xs leading-5 text-kondate-muted">登録すると、<Link href="/terms" className="font-bold underline">利用規約</Link>と<Link href="/privacy" className="font-bold underline">プライバシーポリシー</Link>に同意したものとみなされます。</p>
      <p className="mt-5 text-center text-sm text-kondate-muted">登録済みの方は <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="font-black text-kondate-accent">ログイン</Link></p>
    </AuthShell>
  );
}
