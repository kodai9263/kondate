export type PlannerChange = { kind: "recipe"; recipeId: string } | { kind: "skip"; skipped: boolean }
  | { kind: "lock"; locked: boolean } | { kind: "side"; mode: "default" | "none" | "custom"; sideDishId: string | null };
export type PlannerDay = { date: string; revision: string; recipeId: string; name: string; side: string; minutes: number;
  skipped: boolean; locked: boolean; sideMode: "default" | "none" | "custom"; sideDishId: string | null;
  alternatives: { id: string; name: string; side: string; minutes: number }[] };
export type PlannerSnapshot = { version: 1; date: string; view: "week" | "month"; today: string; label: string;
  previousDate: string; nextDate: string; days: PlannerDay[]; sideDishes: { id: string; name: string }[] };
const endpoint = () => `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""}/api/mobile/v1/planner`;
async function check(response: Response) {
  if (response.ok) return;
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。ログインし直してください。");
  if (body.error === "plan_changed") throw new Error("献立がほかの画面で変更されています。最新の献立を確認してから操作してください。");
  if (body.error === "free_trial_expired") throw new Error("献立の編集には有効な利用期間が必要です。Web版で利用状態をご確認ください。");
  if (body.error === "planner_setup_required") throw new Error("Web版で最初の献立を設定してからご利用ください。");
  if (response.status === 403) throw new Error("この家族の献立を編集できません。");
  throw new Error("献立を読み込み・保存できませんでした。通信を確認し、最新の献立を確認してください。");
}
export async function loadPlanner(token: string, view: "week" | "month", date: string, signal?: AbortSignal): Promise<PlannerSnapshot> {
  const query = new URLSearchParams({ view, ...(date ? { date } : {}) });
  const response = await fetch(`${endpoint()}?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
  await check(response);
  const value = await response.json() as PlannerSnapshot;
  if (value.version !== 1 || !Array.isArray(value.days) || !Array.isArray(value.sideDishes)
    || typeof value.label !== "string" || typeof value.date !== "string"
    || !value.days.every((day) => typeof day.date === "string" && typeof day.revision === "string" && typeof day.name === "string" && Array.isArray(day.alternatives))) {
    throw new Error("献立の形式を確認できませんでした。");
  }
  return value;
}
export async function changePlannerDay(token: string, day: PlannerDay, change: PlannerChange) {
  const response = await fetch(endpoint(), { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ date: day.date, revision: day.revision, change }),
  });
  await check(response);
  const result = await response.json();
  if (result.version !== 1 || result.saved !== true) throw new Error("保存結果を確認できません。最新の献立を確認してください。");
}
