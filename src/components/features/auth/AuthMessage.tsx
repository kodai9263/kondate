const messages: Record<string, string> = {
  setup: "認証の接続設定がまだ完了していません。管理者がSupabaseを設定すると利用できます。",
  invalid: "入力内容を確認してください。パスワードは8文字以上で設定します。",
  credentials: "メールアドレスまたはパスワードが正しくありません。",
  signup: "登録を完了できませんでした。すでに登録済みでないか確認してください。",
  "monitor-full": "無料モニターは10家庭に達したため、受付を終了しました。通常の無料プランは引き続き利用できます。",
  "monitor-unavailable": "無料モニターの受付状況を確認できませんでした。時間をおいてもう一度お試しください。",
  expired: "再設定リンクの期限が切れています。もう一度メールを送信してください。",
  callback: "認証リンクを確認できませんでした。もう一度お試しください。",
};

const successes: Record<string, string> = {
  "check-email": "確認メールを送りました。メール内のリンクを開くと登録が完了します。",
  sent: "入力したアドレスが登録済みの場合、再設定メールが届きます。",
};

export function AuthMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return <p role="alert" className="mb-4 rounded-lg border border-kondate-alert/30 bg-kondate-alertSoft px-3 py-2.5 text-sm leading-6 text-kondate-alert">{messages[error] ?? messages.invalid}</p>;
  }
  if (success) {
    return <p role="status" className="mb-4 rounded-lg border border-kondate-done/30 bg-kondate-doneSoft px-3 py-2.5 text-sm leading-6">{successes[success]}</p>;
  }
  return null;
}
