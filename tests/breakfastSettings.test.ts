import { describe, expect, it } from "vitest";
import { breakfastForDate, breakfastSettingsSchema, breakfastShoppingForWeek, breakfastTemplates, type BreakfastItem, type BreakfastVersion } from "@/lib/breakfast/settings";
import { shoppingWithBreakfast } from "@/lib/breakfast/shopping";
import { menuData } from "@/lib/menuData";
import { toDateKey, toTokyoCalendarDate } from "@/lib/dates";

const item = (name: string, id = "20000000-0000-4000-8000-000000000001"): BreakfastItem => ({ id, sourceKey: null, name, minutes: null, tasks: [], shoppingItems: [name] });
const version = (overrides: Partial<BreakfastVersion> = {}): BreakfastVersion => ({ revision: "30000000-0000-4000-8000-000000000001", effective_date: "2026-09-17", rotation_start: "2026-09-17", legacy_rotation: false, enabled: true, items: [item("ごはん"), item("パン", "20000000-0000-4000-8000-000000000002"), item("シリアル", "20000000-0000-4000-8000-000000000003")], ...overrides });

describe("家庭ごとの朝食", () => {
  it("翌日以降の編集で今日の内容を変えず、最新の有効日を選ぶ", () => {
    const old = version({ effective_date: "2026-09-01", rotation_start: "2026-09-01", items: [item("いつもの朝食")] });
    expect(breakfastForDate([old, version()], "2026-09-16")?.name).toBe("いつもの朝食");
    expect(breakfastForDate([version(), old], "2026-09-17")?.name).toBe("ごはん");
  });
  it("週・月・28日境界でも連続して順番を進める", () => {
    expect(breakfastForDate([version()], "2026-10-15")?.name).toBe("パン");
    expect(breakfastForDate([version()], "2026-10-01")?.name).toBe("シリアル");
    const yearEnd = version({ effective_date: "2026-12-31", rotation_start: "2026-12-31" });
    expect(breakfastForDate([yearEnd], "2027-01-01")?.name).toBe("パン");
  });
  it("移行時だけ従来の28日周期を維持する", () => {
    const legacy = version({ effective_date: "0001-01-01", rotation_start: "2026-07-26", legacy_rotation: true });
    expect(breakfastForDate([legacy], "2026-08-23")?.name).toBe("ごはん");
  });
  it("1件なら毎日同じ。オフでは内容を保持して表示しない", () => {
    expect(breakfastForDate([version({ items: [item("ごはん")] })], "2027-01-01")?.name).toBe("ごはん");
    expect(breakfastForDate([version({ enabled: false })], "2026-09-17")).toBeNull();
  });
  it("日本時間の午前0時を反映日の境界にする", () => {
    expect(toDateKey(toTokyoCalendarDate(new Date("2026-09-16T14:59:59Z")))).toBe("2026-09-16");
    expect(toDateKey(toTokyoCalendarDate(new Date("2026-09-16T15:00:00Z")))).toBe("2026-09-17");
  });
  it("対象週に登場しない朝食の買うものは含めない", () => {
    const items = Array.from({ length: 10 }, (_, index) => item(`品${index}`));
    expect(breakfastShoppingForWeek([version({ items })], "2026-09-17")).toEqual(["品0", "品1", "品2", "品3", "品4", "品5", "品6"]);
  });
  it("週途中の変更と表記の正規化を反映し、分量を勝手に合算しない", () => {
    const old = version({ effective_date: "2026-09-01", rotation_start: "2026-09-01", items: [{ ...item("旧"), shoppingItems: [" 卵 ６個 ", "牛乳"] }] });
    const next = version({ items: [{ ...item("新"), shoppingItems: ["卵 6個", "ヨーグルト"] }] });
    expect(breakfastShoppingForWeek([old, next], "2026-09-13")).toEqual(["卵 6個", "牛乳", "ヨーグルト"]);
  });
  it("夕食用の卵・牛乳・紅生姜を残し、朝食の固定品を除く", () => {
    for (let week = 0; week < 4; week++) {
      const shopping = shoppingWithBreakfast(menuData, week, "2026-09-13", []);
      expect(shopping["朝ごはん定番"]).toBeUndefined();
      expect(Object.values(shopping).flat()).not.toContain("食パン 1斤");
      expect(Object.values(shopping).flat()).not.toContain("バナナ 2房");
      expect(Object.values(shopping).flat()).not.toContain("ヨーグルト 大1");
    }
    expect(shoppingWithBreakfast(menuData, 0, "2026-09-13", [])["豆腐・卵・乳"]).toContain("牛乳 大さじ2");
    expect(shoppingWithBreakfast(menuData, 3, "2026-09-13", [])["冷凍・缶詰"]).toContain("紅生姜 1袋");
  });
  it("すべての定番に編集可能な内容と明示された買うものがある", () => {
    expect(breakfastTemplates).toHaveLength(10);
    for (const template of breakfastTemplates) {
      expect(breakfastSettingsSchema.safeParse({ enabled: true, items: [{ id: item("").id, ...template }] }).success).toBe(true);
      expect(template.shoppingItems.length).toBeGreaterThan(0);
    }
  });
  it("0件オン、上限超過、不正な時間、ID重複は保存しない", () => {
    for (const settings of [
      { enabled: true, items: [] },
      { enabled: true, items: Array(11).fill(item("朝食")) },
      { enabled: true, items: [{ ...item("朝食"), minutes: 1.5 }] },
      { enabled: true, items: [item("朝食1"), item("朝食2")] },
      { enabled: true, items: [{ ...item("朝食"), tasks: Array(21).fill("工程") }] },
    ]) expect(breakfastSettingsSchema.safeParse(settings).success).toBe(false);
    expect(breakfastSettingsSchema.safeParse({ enabled: false, items: [] }).success).toBe(true);
  });
});
