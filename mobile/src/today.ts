export type TodaySnapshot = {
  version: 1;
  fetchedAt: string;
  today: {
    date: string;
    dow: string;
    breakfast: { name: string; minutes?: number; tasks: string[] } | null;
    dinner: {
      dinner: string;
      side: string;
      cookMin: number;
      totalMin?: number;
      morning: string[];
      evening: string[];
      seasonings: string[];
      sideSteps?: string[];
    };
  };
};

export async function loadToday(accessToken: string): Promise<TodaySnapshot> {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/today`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 403) throw new Error("この家族の献立にはアクセスできません。");
  if (!response.ok) throw new Error("今日の献立を読み込めませんでした。接続を確認してください。");
  const value: unknown = await response.json();
  if (!isTodaySnapshot(value)) throw new Error("今日の献立の形式を確認できませんでした。");
  return value;
}

function isTodaySnapshot(value: unknown): value is TodaySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<TodaySnapshot>;
  return snapshot.version === 1 && typeof snapshot.fetchedAt === "string"
    && typeof snapshot.today?.date === "string" && typeof snapshot.today?.dow === "string"
    && typeof snapshot.today?.dinner?.dinner === "string"
    && Array.isArray(snapshot.today.dinner.evening)
    && Array.isArray(snapshot.today.dinner.seasonings);
}
