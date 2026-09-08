import { describe, expect, it } from "vitest";
import { defaultBreakfastChoices, normalizeBreakfastChoices } from "@/lib/breakfast/preferences";

describe("normalizeBreakfastChoices", () => {
  it("旧設定なら従来の4種類を引き継ぐ", () => {
    expect(normalizeBreakfastChoices(undefined)).toEqual(defaultBreakfastChoices);
    expect(defaultBreakfastChoices).toEqual(["A", "B", "C", "D"]);
  });

  it("全て外した状態を維持する", () => {
    expect(normalizeBreakfastChoices([])).toEqual([]);
  });

  it("不正な値と重複を除き、表示順に揃える", () => {
    expect(normalizeBreakfastChoices(["I", "D", "I", "unknown"])).toEqual(["D", "I"]);
  });
});
