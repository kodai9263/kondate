import Link from "next/link";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  return (
    <AuthShell title="パスワードを再設定" description="登録したメールアドレスへ再設定リンクを送ります。">
      <AuthMessage error={error} success={success} />
      <form action={requestPasswordReset} className="space-y-4">
        <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
        <AuthSubmit>再設定メールを送る</AuthSubmit>
      </form>
      <Link href="/login" className="mt-5 flex min-h-11 items-center justify-center text-sm font-black text-kondate-accent">ログインへ戻る</Link>
    </AuthShell>
  );
}
