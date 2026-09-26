import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: true, household: "home", allergies: [] as string[], settingsError: false, saveError: false,
  readError: false, writes: vi.fn(), records: new Map<string, Record<string, unknown>>() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: "user" } : null } }) },
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; }, is: () => query,
      maybeSingle: async () => table === "profiles" ? { data: { household_id: state.household } }
        : table === "household_settings" ? { data: { allergies: state.allergies }, error: state.settingsError }
        : { data: [...state.records.values()].find((row) => row.id === filters.id && row.household_id === filters.household_id), error: state.readError },
      upsert: async (row: Record<string, unknown>, options: unknown) => {
        state.writes(row, options);
        if (state.saveError) return { error: true };
        if (!state.records.has(String(row.id))) state.records.set(String(row.id), row);
        return { error: null };
      },
    };
    return query;
  },
}) }));
import { createStandardSideDish } from "@/app/app/planner/actions";

beforeEach(() => {
  state.user = true; state.household = "home"; state.allergies = []; state.settingsError = false;
  state.saveError = false; state.readError = false; state.writes.mockClear(); state.records.clear();
});
describe("定番副菜の保存", () => {
  it("キーだけを受け取り、家庭の副菜としてサーバーの材料・工程を保存する", async () => {
    const result = await createStandardSideDish("chilled-tofu");
    expect(result).toMatchObject({ ok: true, sideDish: { name: "冷ややっこ", standardKey: "chilled-tofu", servingsBase: 4 } });
    expect(state.writes).toHaveBeenCalledWith(expect.objectContaining({ household_id: "home", ingredients_text: expect.stringContaining("絹ごし豆腐 300g") }), { onConflict: "id", ignoreDuplicates: true });
  });
  it("同時選択しても1件になり、家庭が違えば別に保存する", async () => {
    const [a, b] = await Promise.all([createStandardSideDish("chilled-tofu"), createStandardSideDish("chilled-tofu")]);
    expect(a.sideDish?.id).toBe(b.sideDish?.id); expect(state.records.size).toBe(1);
    state.household = "other-home";
    const other = await createStandardSideDish("chilled-tofu");
    expect(other.sideDish?.id).not.toBe(a.sideDish?.id); expect(state.records.size).toBe(2);
  });
  it("未ログイン・家庭未設定・不正キーを保存しない", async () => {
    for (const key of [null, "unknown", { key: "chilled-tofu", name: "改ざん" }]) expect((await createStandardSideDish(key)).ok).toBe(false);
    state.user = false; expect((await createStandardSideDish("chilled-tofu")).ok).toBe(false);
    state.user = true; state.household = ""; expect((await createStandardSideDish("chilled-tofu")).ok).toBe(false);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("アレルギー候補は画面を経由しなくても保存しない", async () => {
    state.allergies = ["小麦"];
    expect((await createStandardSideDish("chilled-tofu")).message).toContain("アレルギー");
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("設定の取得失敗時は保存せず、保存や読み込みの失敗も成功にしない", async () => {
    state.settingsError = true; expect((await createStandardSideDish("chilled-tofu")).ok).toBe(false);
    expect(state.writes).not.toHaveBeenCalled();
    state.settingsError = false; state.saveError = true; expect((await createStandardSideDish("chilled-tofu")).ok).toBe(false);
    state.saveError = false; state.readError = true; expect((await createStandardSideDish("chilled-tofu")).ok).toBe(false);
  });
});
