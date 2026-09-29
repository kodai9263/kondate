export type AccountPreview = {
  version: 1;
  account: { displayName: string; isAnonymous: boolean };
  household: { memberCount: number; lastMember: boolean };
  subscription: { active: boolean; status: string; provider: "stripe" | "none" };
};

export async function loadAccountPreview(accessToken: string): Promise<AccountPreview> {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/account/deletion-preview`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 403) throw new Error("アカウント情報を確認できませんでした。");
  if (!response.ok) throw new Error("アカウント情報を読み込めませんでした。接続を確認してください。");
  const value: unknown = await response.json();
  if (!isAccountPreview(value)) throw new Error("アカウント情報の形式を確認できませんでした。");
  return value;
}

function isAccountPreview(value: unknown): value is AccountPreview {
  if (!value || typeof value !== "object") return false;
  const preview = value as Partial<AccountPreview>;
  return preview.version === 1 && typeof preview.account?.displayName === "string"
    && typeof preview.account.isAnonymous === "boolean"
    && Number.isInteger(preview.household?.memberCount) && (preview.household?.memberCount ?? 0) > 0
    && typeof preview.household?.lastMember === "boolean"
    && typeof preview.subscription?.active === "boolean"
    && typeof preview.subscription.status === "string"
    && (preview.subscription.provider === "stripe" || preview.subscription.provider === "none");
}
