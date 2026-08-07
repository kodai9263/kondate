const messages: Record<string, string> = {
  setup: "認証の接続設定がまだ完了していません。管理者がSupabaseを設定すると利用できます。",
  invalid: "入力内容を確認してください。パスワードは8文字以上で設定します。",
  credentials: "メールアドレスまたはパスワードが正しくありません。",
  signup: "登録を完了できませんでした。すでに登録済みでないか確認してください。",
  expired: "再設定リンクの期限が切れています。もう一度メールを送信してください。",
  callback: "認証リンクを確認できませんでした。もう一度お試しください。",
};

const successes: Record<string, string> = {
  "check-email": "確認メールを送りました。メール内のリンクを開くと登録が完了します。",
  sent: "入力したアドレスが登録済みの場合、再設定メールが届きます。",
};

export function AuthMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold leading-6 text-red-800">{messages[error] ?? messages.invalid}</p>;
  }
  if (success) {
    return <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold leading-6 text-emerald-900">{successes[success]}</p>;
  }
  return null;
}
