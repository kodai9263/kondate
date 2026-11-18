import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null, owner: true, ownerError: false, rpc: vi.fn(), admin: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user }, error: null }) },
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => table === "recipe_permission_owner"
      ? { data: mocks.owner ? { user_id: "owner" } : null, error: mocks.ownerError ? {} : null }
      : { data: { household_id: "10000000-0000-4000-8000-000000000001" }, error: null } };
    return query;
  }, rpc: mocks.rpc,
}) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
import { requireRecipePermissionOwner } from "@/lib/recipes/sourcePermissions.server";
import { saveSourcePermission } from "@/app/admin/recipe-sources/actions";
beforeEach(() => { mocks.user = { id: "owner" }; mocks.owner = true; mocks.ownerError = false; vi.clearAllMocks(); });
describe("提供元管理の認可", () => {
  it("未ログインはログイン画面へ送る", async () => {
    mocks.user = null; await expect(requireRecipePermissionOwner()).rejects.toThrow("redirect:/login"); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([false, true])("非管理者・権限確認エラーでは保存前に拒否する（エラー=%s）", async error => {
    mocks.owner = error; mocks.ownerError = error;
    await expect(saveSourcePermission({ ok: false, message: "" }, new FormData())).rejects.toThrow("notFound");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("管理者の保存は対象家庭の範囲を確認し、公開状態を変更せずRPCでまとめて保存する", async () => {
    const query = { select: vi.fn(() => query), order: vi.fn(() => query), or: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: { id: "20000000-0000-4000-8000-000000000001" }, error: null })) };
    mocks.admin.mockReturnValue({ from: () => query }); mocks.rpc.mockResolvedValue({ error: null });
    const form = new FormData();
    for (const [key, value] of Object.entries({ recipeId: "20000000-0000-4000-8000-000000000001", providerName: "YouTube", authorName: "作者", sourceUrl: "https://youtu.be/abc", videoStartSeconds: "90", status: "requested", allowedScope: "", checkedOn: "", evidence: "依頼済み" })) form.set(key, value);
    const result = await saveSourcePermission({ ok: false, message: "" }, form);
    expect(result.ok).toBe(true);
    expect(query.or).toHaveBeenCalledWith("household_id.is.null,household_id.eq.10000000-0000-4000-8000-000000000001");
    expect(mocks.rpc).toHaveBeenCalledWith("save_recipe_source_permission", expect.objectContaining({ permission_fields: expect.objectContaining({ evidence: "依頼済み" }) }));
    query.maybeSingle.mockResolvedValueOnce({ data: null as unknown as { id: string }, error: null });
    mocks.rpc.mockClear();
    expect((await saveSourcePermission({ ok: false, message: "" }, form)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("管理者でも入力が不正なら特権取得も保存もしない", async () => {
    expect((await saveSourcePermission({ ok: false, message: "" }, new FormData())).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
});
