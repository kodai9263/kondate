import { updatePassword } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";
import { AuthMessage } from "@/components/features/auth/AuthMessage";
import { AuthShell } from "@/components/features/auth/AuthShell";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="新しいパスワード" description="これから使うパスワードを8文字以上で入力してください。">
      <AuthMessage error={error} />
      <form action={updatePassword} className="space-y-4">
        <AuthField id="password" label="新しいパスワード" type="password" autoComplete="new-password" helper="8文字以上で設定してください。" />
        <AuthSubmit>パスワードを更新</AuthSubmit>
      </form>
    </AuthShell>
  );
}
