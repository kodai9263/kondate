export class ShoppingAccessError extends Error {}
export class ShoppingSessionError extends Error {}

export type ShoppingItem = {
  source: "auto" | "manual";
  id?: string;
  category: string;
  name: string;
  label?: string;
  position: number;
  checked: boolean;
  needsReview?: boolean;
};

export type ShoppingSnapshot = {
  version: 1;
  fetchedAt: string;
  householdId: string;
  period: { storageWeekStart: string; start: string; end: string; mode: "today" | "week" | "custom" };
  groups: Array<{ category: string; items: ShoppingItem[] }>;
  manualItems: ShoppingItem[];
  hasDismissedSeasonings: boolean;
  warnings: string[];
  latestCompletion: { id: string; completedAt: string } | null;
};

export type ShoppingAction =
  | { action: "add"; name: string }
  | { action: "delete"; id: string }
  | { action: "period"; mode: "today" | "week" | "custom"; start?: string; end?: string }
  | { action: "dismiss"; category: string; name: string; position: number }
  | { action: "restore" }
  | { action: "complete" }
  | { action: "undo"; completionId: string };

export async function loadShopping(accessToken: string): Promise<ShoppingSnapshot> {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/shopping`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseShoppingResponse(response);
}

export async function saveShoppingChecked(accessToken: string, snapshot: ShoppingSnapshot, item: ShoppingItem) {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/shopping`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      weekStart: snapshot.period.storageWeekStart,
      rangeStart: snapshot.period.start,
      rangeEnd: snapshot.period.end,
      periodMode: snapshot.period.mode,
      item: { source: item.source, id: item.id, category: item.category, name: item.name,
        position: item.position, checked: !item.checked },
    }),
    cache: "no-store",
  });
  if (response.status === 409) throw new Error("献立や買い物期間が変更されました。リストを更新してください。");
  return parseShoppingResponse(response);
}

export async function performShoppingAction(accessToken: string, snapshot: ShoppingSnapshot, action: ShoppingAction) {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/shopping`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      weekStart: snapshot.period.storageWeekStart,
      rangeStart: snapshot.period.start,
      rangeEnd: snapshot.period.end,
      periodMode: snapshot.period.mode,
      ...action,
    }),
    cache: "no-store",
  });
  if (response.status === 409) throw new Error("買い物リストが更新されました。最新の内容を確認してください。");
  if (response.status === 401) throw new ShoppingSessionError("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 403) throw new ShoppingAccessError("この家族の買い物リストにはアクセスできません。");
  if (!response.ok) throw new Error("保存できませんでした。接続を確認してください。");
  return loadShopping(accessToken);
}

async function parseShoppingResponse(response: Response): Promise<ShoppingSnapshot> {
  if (response.status === 401) throw new ShoppingSessionError("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 403) throw new ShoppingAccessError("この家族の買い物リストにはアクセスできません。");
  if (!response.ok) throw new Error("買い物リストを読み込めませんでした。接続を確認してください。");
  const value: unknown = await response.json();
  if (!isShoppingSnapshot(value)) throw new Error("買い物リストの形式を確認できませんでした。");
  return value;
}

export function isShoppingSnapshot(value: unknown): value is ShoppingSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ShoppingSnapshot>;
  return snapshot.version === 1 && typeof snapshot.fetchedAt === "string"
    && typeof snapshot.householdId === "string" && Array.isArray(snapshot.groups)
    && Array.isArray(snapshot.manualItems) && Array.isArray(snapshot.warnings)
    && typeof snapshot.hasDismissedSeasonings === "boolean"
    && (snapshot.latestCompletion === null || (typeof snapshot.latestCompletion?.id === "string"
      && typeof snapshot.latestCompletion.completedAt === "string"))
    && typeof snapshot.period?.storageWeekStart === "string"
    && typeof snapshot.period.start === "string" && typeof snapshot.period.end === "string";
}
