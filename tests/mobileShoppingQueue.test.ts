import { describe, expect, it, vi } from "vitest";
import { ShoppingMutationQueue, applyShoppingChange, type ShoppingChange } from "../mobile/src/shoppingQueue";
import { ShoppingAccessError, ShoppingConflictError, type ShoppingSnapshot, type ShoppingItem } from "../mobile/src/shopping";
const item: ShoppingItem = { source: "auto", category: "野菜", name: "にんじん", position: 0, checked: false };
const base: ShoppingSnapshot = { version: 1, fetchedAt: "2026-10-04T00:00:00Z", householdId: "test", period: { storageWeekStart: "2026-10-04", start: "2026-10-04", end: "2026-10-10", mode: "week" }, groups: [{ category: "野菜", items: [item] }], manualItems: [{ ...item, source: "manual", id: "one" }, { ...item, source: "manual", id: "two" }], hasDismissedSeasonings: false, warnings: [], latestCompletion: null };
const check: ShoppingChange = { kind: "check", item, checked: true };
function deferred() { let resolve!: (value: ShoppingSnapshot) => void; let reject!: (error: unknown) => void; const promise = new Promise<ShoppingSnapshot>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture() {
  const first = deferred();
  const execute = vi.fn<(snapshot: ShoppingSnapshot, change: ShoppingChange) => Promise<ShoppingSnapshot>>().mockImplementationOnce(() => first.promise).mockImplementation(async (snapshot, change) => applyShoppingChange(snapshot, change));
  const handlers = { execute, reload: vi.fn().mockResolvedValue(base), onState: vi.fn(), onConfirmed: vi.fn(), onError: vi.fn() };
  return { first, handlers, queue: new ShoppingMutationQueue(base, handlers) };
}
describe("買い物の連続操作保存", () => {
  it("同じ品物の連続チェックを即時表示し、古い応答でも後続操作を消さない", async () => {
    const { queue, first, handlers } = fixture();
    queue.enqueue(check); queue.enqueue({ ...check, checked: false });
    expect(handlers.execute).toHaveBeenCalledTimes(1);
    expect(handlers.onState.mock.lastCall?.[0].groups[0].items[0].checked).toBe(false);
    expect(handlers.onConfirmed).not.toHaveBeenCalled();
    first.resolve(applyShoppingChange(base, check));
    await vi.waitFor(() => expect(queue.pending).toBe(false));
    expect(handlers.execute).toHaveBeenCalledTimes(2);
    expect(handlers.onState.mock.lastCall?.[0].groups[0].items[0].checked).toBe(false);
    expect(handlers.onState.mock.calls.every(([state]) => !state.groups[0].items[0].checked || state === handlers.onState.mock.calls[0][0])).toBe(true);
  });
  it("チェック保存中に複数削除を即時表示し、通信を直列に処理する", async () => {
    const { queue, first, handlers } = fixture();
    queue.enqueue(check); queue.enqueue({ kind: "delete", id: "one" }); queue.enqueue({ kind: "delete", id: "two" });
    expect(handlers.onState.mock.lastCall?.[0].manualItems).toEqual([]);
    expect(handlers.execute).toHaveBeenCalledTimes(1);
    first.resolve(applyShoppingChange(base, check));
    await vi.waitFor(() => expect(queue.pending).toBe(false));
    expect(handlers.execute).toHaveBeenCalledTimes(3);
    expect(handlers.onConfirmed.mock.lastCall?.[0].manualItems).toEqual([]);
  });
  it("失敗した操作を再送せず、最新状態に後続の削除だけを適用する", async () => {
    const { queue, first, handlers } = fixture();
    queue.enqueue(check); queue.enqueue({ kind: "delete", id: "one" });
    first.reject(new TypeError("failed to fetch"));
    await vi.waitFor(() => expect(queue.pending).toBe(false));
    expect(handlers.reload).toHaveBeenCalledTimes(1);
    expect(handlers.execute).toHaveBeenCalledTimes(2);
    expect(handlers.onState.mock.lastCall?.[0].groups[0].items[0].checked).toBe(false);
    expect(handlers.onState.mock.lastCall?.[0].manualItems.map((x: ShoppingItem) => x.id)).toEqual(["two"]);
  });
  it("削除の応答が失われても、確認取得で消えていれば元に戻さない", async () => {
    const { queue, first, handlers } = fixture();
    handlers.reload.mockResolvedValue(applyShoppingChange(base, { kind: "delete", id: "one" }));
    queue.enqueue({ kind: "delete", id: "one" }); first.reject(new TypeError("offline"));
    await vi.waitFor(() => expect(queue.pending).toBe(false));
    expect(handlers.execute).toHaveBeenCalledTimes(1);
    expect(handlers.onState.mock.lastCall?.[0].manualItems.map((x: ShoppingItem) => x.id)).toEqual(["two"]);
  });
  it("保存結果の確認も失敗したら後続を送らず、未保存の変更を戻す", async () => {
    const { queue, first, handlers } = fixture();
    handlers.reload.mockRejectedValue(new Error("offline"));
    queue.enqueue(check); queue.enqueue({ kind: "delete", id: "one" }); first.reject(new Error("offline"));
    await vi.waitFor(() => expect(queue.pending).toBe(false));
    expect(handlers.execute).toHaveBeenCalledTimes(1);
    expect(handlers.onState.mock.lastCall?.[0]).toEqual(base);
    expect(handlers.onError.mock.lastCall?.[0].message).toContain("未保存の変更を戻しました");
  });
  it("期間競合では待機中の操作を破棄する", async () => {
    const { queue, first, handlers } = fixture(); queue.enqueue(check); queue.enqueue({ kind: "delete", id: "one" });
    first.reject(new ShoppingConflictError("period changed"));
    await vi.waitFor(() => expect(queue.pending).toBe(false)); expect(handlers.execute).toHaveBeenCalledTimes(1);
  });
  it("確認取得で期間が変わっていた場合も後続操作を新期間に送らない", async () => {
    const { queue, first, handlers } = fixture();
    handlers.reload.mockResolvedValue({ ...base, period: { ...base.period, end: "2026-10-11" } });
    queue.enqueue(check); queue.enqueue({ kind: "delete", id: "one" }); first.reject(new Error("failed"));
    await vi.waitFor(() => expect(queue.pending).toBe(false)); expect(handlers.execute).toHaveBeenCalledTimes(1);
  });
  it("ログアウト後の応答で画面・キャッシュを復活させない", async () => {
    const { queue, first, handlers } = fixture(); queue.enqueue(check); queue.cancel(); handlers.onState.mockClear();
    first.resolve(applyShoppingChange(base, check)); await new Promise(resolve => setTimeout(resolve, 0));
    expect(handlers.onState).not.toHaveBeenCalled(); expect(handlers.onConfirmed).not.toHaveBeenCalled();
  });
  it("認証・権限エラーでは後続保存と確認取得を停止する", async () => {
    const { queue, first, handlers } = fixture(); queue.enqueue(check); queue.enqueue({ kind: "delete", id: "one" }); first.reject(new ShoppingAccessError("denied"));
    await vi.waitFor(() => expect(queue.pending).toBe(false)); expect(handlers.reload).not.toHaveBeenCalled(); expect(handlers.execute).toHaveBeenCalledTimes(1);
  });
  it("調味料の削除を即時反映し、同名の手動品を残す", () => {
    const result = applyShoppingChange(base, { kind: "dismiss", item }); expect(result.groups[0].items).toEqual([]); expect(result.manualItems).toHaveLength(2); expect(result.hasDismissedSeasonings).toBe(true);
  });
});
