import { describe, expect, it } from "vitest";
import { firstWeekDates, isCompleteFirstWeek, normalizeMenuNext, normalizeRecipeSelection } from "@/lib/billing/firstWeek";

describe("初回の7日分", () => {
  it("月末・年末をまたいで連続7日を作る", () => {
    expect(firstWeekDates("2026-12-29")).toEqual(["2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04"]);
  });
  it("重複・8日目・欠落を無料期間として保存しない", () => {
    const entries = firstWeekDates("2026-10-29").map((date) => ({ date }));
    expect(isCompleteFirstWeek("2026-10-29", entries)).toBe(true);
    expect(isCompleteFirstWeek("2026-10-29", [...entries.slice(0, 6), entries[0]])).toBe(false);
    expect(isCompleteFirstWeek("2026-10-29", [...entries.slice(0, 6), { date: "2026-11-05" }])).toBe(false);
    expect(isCompleteFirstWeek("2026-10-29", entries.slice(0, 6))).toBe(false);
  });
  it("不正日付と上限を超える期間を拒否", () => {
    expect(() => firstWeekDates("2026-02-30")).toThrow();
    expect(() => firstWeekDates("2100-12-26")).toThrow();
  });
});

describe("料理選択の認証引き継ぎ", () => {
  it("料理の選択とお気に入りの目的を維持", () => {
    expect(normalizeMenuNext("/app/planner/setup?recipe=official%3Asalmon")).toBe("/app/planner/setup?recipe=official%3Asalmon");
    expect(normalizeMenuNext("/app/favorites?recipe=official%3Asalmon")).toBe("/app/favorites?recipe=official%3Asalmon");
  });
  it("外部URL・不正な選択・他のパスへの誘導を拒否", () => {
    for (const next of ["//evil.example", "https://evil.example", "/app/planner/setup?recipe=official%3Asalmon&next=//evil", "/app/favorites?recipe=%ZZ", "/app/planner/setup?recipe=custom:secret", "/app/\\evil"]) expect(normalizeMenuNext(next)).toBe("/app");
    expect(normalizeRecipeSelection("custom:secret")).toBeNull();
  });
});
