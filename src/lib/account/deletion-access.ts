// サーバー側だけで設定する。メールアドレスや利用者が変更できる情報では許可しない。
export function deletionTestUserIds(): string[] {
  return (process.env.ACCOUNT_DELETION_TEST_USER_IDS ?? "").split(",")
    .map((id) => id.trim()).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}

export function canDeleteAccount(userId: string): boolean {
  return process.env.ACCOUNT_DELETION_ENABLED === "true" || deletionTestUserIds().includes(userId);
}
