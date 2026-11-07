export function planningAccessMessage(code: unknown): string | null {
  if (code === "planner_setup_required") {
    return "最初に人数・アレルギー・献立の開始日を確認してください。アプリの「今日」から設定できます。";
  }
  if (code === "free_trial_expired") {
    return "献立を利用できる期間が終了しています。「設定」の家族プランで、契約の確認や購入の復元ができます。";
  }
  if (code === "family_access_required") {
    return "家族共有には家族プランが必要です。家族の契約者に利用状態を確認してください。";
  }
  return null;
}

export class PlanningSetupRequired extends Error {
  constructor() { super(planningAccessMessage("planner_setup_required")!); }
}
