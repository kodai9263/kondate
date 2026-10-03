import { describe, expect, it } from "vitest";
import { isFreeTrialActive, formatTrialEnd } from "@/lib/billing/freeTrial";

const trial = { started_at: "2026-10-03T03:00:00Z", expires_at: "2026-10-17T03:00:00Z" };
describe("登録から14日間の無料体験", () => {
  it("開始日時を含み、終了日時から利用不可になる", () => {
    expect(isFreeTrialActive(trial, Date.parse(trial.started_at) - 1)).toBe(false);
    expect(isFreeTrialActive(trial, Date.parse(trial.started_at))).toBe(true);
    expect(isFreeTrialActive(trial, Date.parse(trial.expires_at) - 1)).toBe(true);
    expect(isFreeTrialActive(trial, Date.parse(trial.expires_at))).toBe(false);
  });
  it("日付変更や週をまたいでも登録からの336時間で判定する", () => {
    expect(Date.parse(trial.expires_at) - Date.parse(trial.started_at)).toBe(336 * 60 * 60 * 1000);
    expect(isFreeTrialActive(trial, Date.parse("2026-10-16T23:59:59Z"))).toBe(true);
  });
  it("記録なしや不正な終了日時で権限を付与しない", () => {
    expect(isFreeTrialActive(null)).toBe(false);
    expect(isFreeTrialActive({ ...trial, expires_at: "invalid" })).toBe(false);
  });
  it("終了日時を日本時間で表示する", () => {
    expect(formatTrialEnd(trial.expires_at)).toContain("2026/10/17 12:00");
  });
});
