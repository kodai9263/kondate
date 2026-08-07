import Link from "next/link";
import { login } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { redirectIfAuthenticated } from "@/lib/auth/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await redirectIfAuthenticated();
  const { error } = await searchParams;
  return (
    <AuthShell title="おかえりなさい" description="一度ログインすれば、この端末では次回からそのまま続きを開けます。">
      <AuthMessage error={error} />
      <form action={login} className="space-y-4">
        <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
        <AuthField id="password" label="パスワード" type="password" autoComplete="current-password" />
        <div className="text-right"><Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-bold text-kondate-accent">パスワードを忘れた方</Link></div>
        <AuthSubmit>ログイン</AuthSubmit>
      </form>
      <p className="mt-6 text-center text-sm text-kondate-muted">初めての方は <Link href="/signup" className="font-black text-kondate-accent">無料で登録</Link></p>
    </AuthShell>
  );
}
