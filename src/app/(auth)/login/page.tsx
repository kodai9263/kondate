import Link from "next/link";
import { login } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { normalizeInviteToken } from "@/lib/family/invites";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string }> }) {
  await redirectIfAuthenticated();
  const { error, invite } = await searchParams;
  const inviteToken = normalizeInviteToken(invite);
  return (
    <AuthShell title="おかえりなさい" description="一度ログインすれば、この端末では次回からそのまま続きを開けます。">
      <AuthMessage error={error} />
      {inviteToken ? <p className="mb-4 rounded-lg border border-kondate-line bg-kondate-bg p-3 text-sm text-kondate-muted">ログイン後、招待された家族グループに参加します。</p> : null}
      <form action={login} className="space-y-4">
        {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
        <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
        <AuthField id="password" label="パスワード" type="password" autoComplete="current-password" />
        <div className="text-right"><Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-kondate-muted underline decoration-kondate-line underline-offset-4 transition-colors hover:text-kondate-accent hover:decoration-kondate-accent">パスワードを忘れた方</Link></div>
        <AuthSubmit>ログイン</AuthSubmit>
      </form>
      <p className="mt-6 border-t border-kondate-line pt-5 text-center text-sm text-kondate-muted">初めての方は <Link href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"} className="font-semibold text-kondate-accent underline-offset-4 hover:underline">無料で登録</Link></p>
    </AuthShell>
  );
}
