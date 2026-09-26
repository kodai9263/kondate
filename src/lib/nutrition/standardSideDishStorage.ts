import { createHash } from "node:crypto";
import { standardSideDishes, standardSideServings } from "./standardSideDishes";
import type { SideDish } from "@/types/nutrition";

// 家庭と定番キーからUUID v5を作る。同時選択・再選択でも同じ家庭に同じ副菜を重複登録しない。
// v1のキーと基準人数は保存データの識別に使うため、既存分を変更・削除しない。
export function standardSideDishId(householdId: string, key: string) {
  const namespace = Buffer.from("b11bbf326ea14aabb780dddf1ce18c74", "hex");
  const bytes = createHash("sha1").update(namespace).update(`v1:${householdId}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function restoreStandardSideMetadata(sideDish: SideDish, householdId?: string): SideDish {
  const standard = householdId && standardSideDishes.find((dish) => standardSideDishId(householdId, dish.key) === sideDish.id);
  return standard ? { ...sideDish, standardKey: standard.key, servingsBase: standardSideServings } : sideDish;
}
