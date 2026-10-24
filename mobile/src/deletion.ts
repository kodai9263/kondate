export type DeletionStatus = { receipt: string; status: "processing" | "completed" };

function apiBase() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

async function request(body: unknown, accessToken?: string): Promise<DeletionStatus> {
  const response = await fetch(`${apiBase()}/api/mobile/v1/account/deletion`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(body), cache: "no-store",
  });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 409) throw new Error("共有写真の移管が必要です。退会前にサポートへご連絡ください。");
  if (!response.ok && response.status !== 202) throw new Error("退会の処理を確認できませんでした。接続を確認して再度お試しください。");
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new Error("退会の受付結果を確認できませんでした。");
  const result = value as { version?: unknown; receipt?: unknown; status?: unknown };
  if (result.version !== 1 || typeof result.receipt !== "string" ||
    (result.status !== "processing" && result.status !== "completed")) {
    throw new Error("退会の受付結果を確認できませんでした。");
  }
  return { receipt: result.receipt, status: result.status };
}

export function requestAccountDeletion(accessToken: string) {
  return request({ action: "delete", confirmation: "削除" }, accessToken);
}

export function checkAccountDeletion(receipt: string) {
  return request({ action: "status", receipt });
}
