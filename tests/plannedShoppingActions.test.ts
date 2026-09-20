import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), context: vi.fn(), shopping: vi.fn(), saved: vi.fn() }));
vi.mock("@/lib/shopping/server", () => ({ getShoppingContext: mock.context, getPlannedShopping: mock.shopping, getSavedShoppingState: mock.saved }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addManualShoppingItem, changeShoppingPeriod, completeShopping, dismissSeasoningShoppingItem, setShoppingItemChecked, undoShoppingCompletion } from "@/app/app/shopping/actions";
const item = { weekStart: "2026-09-20", rangeStart: "2026-09-19", rangeEnd: "2026-09-25", periodMode: "week", category: "肉", name: "planned-v1:actual", position: 0, checked: true };
beforeEach(() => {
  vi.clearAllMocks();
  mock.context.mockResolvedValue({ period: { storageWeekStart: item.weekStart, start: item.rangeStart, end: item.rangeEnd, mode: item.periodMode }, supabase: { rpc: mock.rpc } });
  mock.shopping.mockResolvedValue({ groups: [{ category: "肉", items: [{ category: "肉", name: item.name, label: "豚肉 400g", position: 0,
    contributions: [{ key: "meal-key", date: "2026-09-20", meal: "夕食", original: "豚肉 400g", scale: 1 }] }] }] });
  mock.saved.mockResolvedValue({ checkedKeys: [`肉\u001f${item.name}`], dismissedKeys: [], manualItems: [] });
  mock.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
describe("買い物保存時の照合", () => {
  it("実際に集計した品目だけを保存する", async () => {
    expect(await setShoppingItemChecked(item)).toEqual({ ok: true });
    expect(mock.rpc).toHaveBeenCalledWith("update_planned_shopping", expect.objectContaining({ expected_range_start: "2026-09-19", expected_range_end: "2026-09-25", expected_period_mode: "week", operation: "check" }));
  });
  it("献立変更前の品名・古い期間・範囲外位置を保存しない", async () => {
    for (const changed of [{ name: "planned-v1:old" }, { weekStart: "2026-09-13" }, { rangeStart: "2026-09-18" }, { rangeEnd: "2026-09-26" }, { periodMode: "custom" }, { position: 1 }]) {
      expect(await setShoppingItemChecked({ ...item, ...changed })).toEqual({ ok: false });
    }
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("読み込み失敗時に固定リストへ置き換えて保存しない", async () => {
    mock.shopping.mockRejectedValue(new Error("offline"));
    expect(await setShoppingItemChecked(item)).toEqual({ ok: false });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("調味料以外の非表示要求を拒否する", async () => {
    expect(await dismissSeasoningShoppingItem(item)).toEqual({ ok: false });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("家族が先に期間を変えた場合は失敗を返す", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "shopping_period_changed" } });
    expect(await changeShoppingPeriod({ ...item, mode: "today" })).toEqual({ ok: false });
  });
  it.each(["today", "week", "custom"])("%sへの期間変更を保存する", async (mode) => {
    expect(await changeShoppingPeriod({ ...item, mode, start: "2026-09-30", end: "2026-10-12" })).toEqual({ ok: true });
    expect(mock.rpc).toHaveBeenCalledWith("update_planned_shopping", expect.objectContaining({ operation: "period", item: { mode, start: "2026-09-30", end: "2026-10-12" } }));
  });
  it.each([
    { start: "2026-09-30", end: "2026-09-29" }, { start: "2026-02-31", end: "2026-03-01" },
    { start: "2026-01-01", end: "2027-01-02" }, { start: "2026-09-30" }, {},
  ])("不正な指定期間をDBに送らない: %j", async (range) => {
    expect(await changeShoppingPeriod({ ...item, mode: "custom", ...range })).toEqual({ ok: false });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("手動品は材料データの有無に依存せず、現在の期間で保存する", async () => {
    expect(await addManualShoppingItem({ ...item, name: "洗剤" })).toEqual({ ok: true });
    expect(mock.shopping).not.toHaveBeenCalled();
  });
  it("チェック済み品の材料根拠をサーバーで再計算して完了保存する", async () => {
    mock.rpc.mockResolvedValue({ data: { ok: true, completion_id: "30000000-0000-4000-8000-000000000001", completed_count: 1 }, error: null });
    expect(await completeShopping(item)).toEqual({ ok: true, completionId: "30000000-0000-4000-8000-000000000001", completedCount: 1 });
    expect(mock.rpc).toHaveBeenCalledWith("complete_planned_shopping", expect.objectContaining({
      target_week_start: item.weekStart,
      auto_items: [expect.objectContaining({ source: "auto", name: item.name, contributions: [expect.objectContaining({ key: "meal-key" })] })],
      manual_ids: [],
    }));
  });
  it("チェック済み品が現在の集計にない場合は完了を作らない", async () => {
    mock.saved.mockResolvedValue({ checkedKeys: ["肉\u001fplanned-v1:old"], dismissedKeys: [], manualItems: [] });
    expect(await completeShopping(item)).toEqual({ ok: false });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("現在の期間にある直前の完了を取り消す", async () => {
    const completionId = "30000000-0000-4000-8000-000000000001";
    mock.rpc.mockResolvedValue({ data: { ok: true, restored_count: 2 }, error: null });
    expect(await undoShoppingCompletion({ ...item, completionId })).toEqual({ ok: true, completedCount: 2 });
    expect(mock.rpc).toHaveBeenCalledWith("undo_planned_shopping_completion", expect.objectContaining({ target_completion_id: completionId }));
  });
});
