import { describe, expect, it } from "vitest";
import { defaultFamilySize, formatServingLabel, formatShoppingDay, getFamilyScale, normalizeShoppingDay, scaleQuantityText } from "@/lib/family/servings";

describe("family servings", () => {
  it("既存の大人2人・子ども3人では数量を変えない", () => {
    expect(getFamilyScale(defaultFamilySize)).toBe(1);
    expect(scaleQuantityText("合いびき肉 500g", defaultFamilySize)).toBe("合いびき肉 500g");
  });

  it("大人と子どもの食事量から買い物数量を調整する", () => {
    const familySize = { adultCount: 2, childCount: 0 };
    expect(scaleQuantityText("合いびき肉 500g", familySize)).toBe("合いびき肉 270g");
    expect(scaleQuantityText("生鮭 5切れ", familySize)).toBe("生鮭 3切れ");
    expect(scaleQuantityText("キャベツ 1/2個", familySize)).toBe("キャベツ 1/4個");
  });

  it("献立内の調味料も人数に合わせる", () => {
    const familySize = { adultCount: 4, childCount: 2 };
    expect(scaleQuantityText("醤油大さじ3・水900ml", familySize)).toBe("醤油大さじ4と1/4・水1240ml");
    expect(formatServingLabel(familySize)).toBe("大人4人・子ども2人（5.2人前相当）");
  });

  it("買い物曜日を日曜から土曜の範囲に保つ", () => {
    expect(formatShoppingDay(3)).toBe("水");
    expect(formatShoppingDay(normalizeShoppingDay(9))).toBe("土");
  });
});
