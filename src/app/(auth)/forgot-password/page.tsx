import Link from "next/link";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  if (success === "sent" && !error) {
    return (
      <AuthShell title="メールをご確認ください" description="パスワード再設定のリクエストを受け付けました。">
        <div role="status" className="rounded-xl border border-kondate-done/30 bg-kondate-doneSoft p-5 leading-7">
          <p className="font-bold">登録済みのアドレスへ再設定メールを送ります。</p>
          <p className="mt-3">最新のメールにある「パスワードを再設定する」を押してください。メールアプリからそのまま進められます。</p>
          <p className="mt-3 text-sm">見当たらない場合は、迷惑メールと入力したアドレスをご確認ください。</p>
        </div>
        <Link href="/forgot-password" className="mt-5 flex min-h-11 items-center justify-center font-semibold text-kondate-accent underline">別のアドレスで試す・再送する</Link>
        <Link href="/login" className="mt-3 flex min-h-11 items-center justify-center text-sm underline">ログインへ戻る</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="パスワードを再設定" description="登録したメールアドレスへ再設定リンクを送ります。">
      <AuthMessage error={error} success={success} />
      <form action={requestPasswordReset} className="space-y-4">
        <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
        <AuthSubmit>再設定メールを送る</AuthSubmit>
      </form>
      <Link href="/login" className="mt-5 flex min-h-11 items-center justify-center border-t border-kondate-line pt-5 text-sm font-semibold text-kondate-accent underline-offset-4 hover:underline">ログインへ戻る</Link>
    </AuthShell>
  );
}
