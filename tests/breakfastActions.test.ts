import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { saveBreakfastSettings } from "@/app/account/breakfast-actions";
const input = { revision: "10000000-0000-4000-8000-000000000001", settings: { enabled: false, items: [] } };
beforeEach(() => vi.clearAllMocks());
describe("朝食保存", () => {
  it("検証エラーはDBへ送らない", async () => {
    expect((await saveBreakfastSettings({ ...input, settings: { enabled: true, items: [] } })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("競合時は入力を残すためのエラーを返し、成功扱いしない", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "breakfast_conflict" } });
    expect(await saveBreakfastSettings(input)).toEqual({ ok: false, error: expect.stringContaining("家族が設定を変更") });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("通信障害を成功や朝食オフにしない", async () => {
    mocks.rpc.mockRejectedValue(new Error("offline"));
    expect((await saveBreakfastSettings(input)).ok).toBe(false);
  });
  it("DBが確定した版と反映日を返し、関連画面を更新する", async () => {
    mocks.rpc.mockResolvedValue({ data: { revision: input.revision, effectiveDate: "2026-09-18", changed: true } });
    expect(await saveBreakfastSettings(input)).toEqual({ ok: true, revision: input.revision, effectiveDate: "2026-09-18", changed: true });
    expect(mocks.rpc).toHaveBeenCalledWith("save_household_breakfast", { expected_revision: input.revision, settings: input.settings });
    expect(mocks.revalidatePath.mock.calls.map((call) => call[0])).toEqual(["/account", "/app", "/app/shopping"]);
  });
});
