import { describe, expect, it } from "vitest";
import { countCheckedTasks, countTasks, type TodayTaskBindings, updateTaskBindings } from "@/lib/realtime/taskState";

const bindings: TodayTaskBindings = {
  breakfast: [{ planEntryId: "plan-1", stepId: "step-1", text: "朝", checked: false }],
  seasoning: [{ planEntryId: "plan-2", stepId: "step-seasoning", text: "醤油 大さじ2", checked: false }],
  morning: [{ planEntryId: "plan-2", stepId: "step-2", text: "仕込み", checked: true }],
  evening: [{ planEntryId: "plan-2", stepId: "step-3", text: "夜", checked: false }],
};

describe("家族共有タスク状態", () => {
  it("対象の手順だけを更新する", () => {
    const updated = updateTaskBindings(bindings, "step-3", true);

    expect(updated.evening[0].checked).toBe(true);
    expect(updated.seasoning[0].checked).toBe(false);
    expect(updated.breakfast[0].checked).toBe(false);
    expect(bindings.evening[0].checked).toBe(false);
  });

  it("完了数を全時間帯から集計する", () => {
    expect(countCheckedTasks(bindings)).toBe(1);
    expect(countTasks(bindings)).toBe(4);
  });
});
