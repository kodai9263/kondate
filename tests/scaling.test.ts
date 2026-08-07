import { describe, expect, it } from "vitest";
import { scaleIngredient, scaleQuantity } from "@/lib/scaling";

describe("scaleQuantity", () => {
  it("5人分から4人分へ換算する", () => {
    expect(scaleQuantity(500, 5, 4)).toBe(400);
  });

  it("少量は小数1桁へ丸める", () => {
    expect(scaleQuantity(1, 5, 4)).toBe(0.8);
  });

  it("適量はnullのまま返す", () => {
    expect(scaleIngredient({ name: "塩", quantity: null, unit: null }, 5, 4)).toEqual({
      name: "塩",
      quantity: null,
      unit: null,
    });
  });
});
