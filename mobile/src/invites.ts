export type FamilyInvite = { id: string; url: string; expiresAt: string };

function apiBase() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function parseInvite(value: unknown): FamilyInvite {
  if (!value || typeof value !== "object") throw new Error("招待リンクの形式を確認できませんでした。");
  const invite = value as Partial<FamilyInvite>;
  if (typeof invite.id !== "string" || typeof invite.url !== "string" || typeof invite.expiresAt !== "string") {
    throw new Error("招待リンクの形式を確認できませんでした。");
  }
  const url = new URL(invite.url);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("招待リンクの形式を確認できませんでした。");
  return invite as FamilyInvite;
}

async function requestInvites(accessToken: string, method: "GET" | "POST" | "DELETE", id?: string) {
  const response = await fetch(`${apiBase()}/api/mobile/v1/invites`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(id ? { "Content-Type": "application/json" } : {}) },
    ...(id ? { body: JSON.stringify({ id }) } : {}),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 403) throw new Error("招待には家族プランとメール登録が必要です。");
  if (!response.ok) throw new Error("招待リンクを確認できませんでした。接続を確認してください。");
  return response.json() as Promise<unknown>;
}

export async function loadFamilyInvites(accessToken: string): Promise<FamilyInvite[]> {
  const value = await requestInvites(accessToken, "GET") as { version?: unknown; invites?: unknown };
  if (value.version !== 1 || !Array.isArray(value.invites)) throw new Error("招待リンクの形式を確認できませんでした。");
  return value.invites.map(parseInvite);
}

export async function createFamilyInvite(accessToken: string): Promise<FamilyInvite> {
  const value = await requestInvites(accessToken, "POST") as { version?: unknown; invite?: unknown };
  if (value.version !== 1) throw new Error("招待リンクの形式を確認できませんでした。");
  return parseInvite(value.invite);
}

export async function revokeFamilyInvite(accessToken: string, id: string): Promise<void> {
  const value = await requestInvites(accessToken, "DELETE", id) as { version?: unknown; revoked?: unknown };
  if (value.version !== 1 || value.revoked !== true) throw new Error("招待リンクの解除を確認できませんでした。");
}
