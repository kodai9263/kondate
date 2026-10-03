export type FreeTrial = { started_at: string; expires_at: string };

export function isFreeTrialActive(trial: FreeTrial | null, now = Date.now()): boolean {
  if (!trial) return false;
  const start = Date.parse(trial.started_at);
  const end = Date.parse(trial.expires_at);
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}

export function formatTrialEnd(expiresAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(expiresAt));
}
