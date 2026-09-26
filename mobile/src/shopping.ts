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
  period: { start: string; end: string; mode: "today" | "week" | "custom" };
  groups: Array<{ category: string; items: ShoppingItem[] }>;
  manualItems: ShoppingItem[];
  warnings: string[];
};

export async function loadShopping(accessToken: string): Promise<ShoppingSnapshot> {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/shopping`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 403) throw new Error("この家族の買い物リストにはアクセスできません。");
  if (!response.ok) throw new Error("買い物リストを読み込めませんでした。接続を確認してください。");
  const value: unknown = await response.json();
  if (!isShoppingSnapshot(value)) throw new Error("買い物リストの形式を確認できませんでした。");
  return value;
}

function isShoppingSnapshot(value: unknown): value is ShoppingSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ShoppingSnapshot>;
  return snapshot.version === 1 && typeof snapshot.fetchedAt === "string"
    && typeof snapshot.householdId === "string" && Array.isArray(snapshot.groups)
    && Array.isArray(snapshot.manualItems) && Array.isArray(snapshot.warnings)
    && typeof snapshot.period?.start === "string" && typeof snapshot.period.end === "string";
}
