import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ user: { id: "user" } as {id: string} | null, rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: mock.user } }) }, rpc: mock.rpc }) }));
vi.mock("@/lib/recipes/importer", async original => ({ ...await original<typeof import("@/lib/recipes/importer")>(), fetchImportedRecipe: mock.fetch }));
import { createRecipe, importRecipeFromUrl } from "@/app/app/recipes/new/actions";
const form = () => { const data = new FormData(); Object.entries({ name: "検証", side: "", cookMinutes: "30", servings: "2", proteinSource: "egg", ingredients: "卵 2個", steps: "加熱する", sourceUrl: "https://cookpad.com/jp/recipes/123456", importConfirmed: "yes" }).forEach(([key,value])=>data.set(key,value)); return data; };
beforeEach(() => { vi.clearAllMocks(); mock.user={id:"user"}; mock.rpc.mockResolvedValue({ data: true, error: null }); mock.fetch.mockResolvedValue({ name: "検証" }); });
describe("家族向けURL登録の認証と保存", () => {
 it("未ログインでは外部ページへ接続しない", async () => { mock.user=null; expect((await importRecipeFromUrl("https://cookpad.com/jp/recipes/123456")).ok).toBe(false); expect(mock.fetch).not.toHaveBeenCalled(); });
 it("利用期間外では外部ページへ接続しない", async () => { mock.rpc.mockResolvedValue({data:false,error:null}); expect((await importRecipeFromUrl("https://cookpad.com/jp/recipes/123456")).ok).toBe(false); expect(mock.fetch).not.toHaveBeenCalled(); });
 it("利用可能なアカウントでも外部ページへ接続しない", async () => {
   expect(await importRecipeFromUrl("https://cookpad.com/jp/recipes/123456")).toMatchObject({ ok: false, message: expect.stringContaining("休止中") });
   expect(mock.fetch).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("旧画面からの取り込み済み保存を拒否する", async () => {
   await expect(createRecipe(form())).rejects.toThrow("error=import_paused");
   expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("全体公開は保存しない", async () => {
   const data=form(); data.set("visibility","community");
   await expect(createRecipe(data)).rejects.toThrow("error=publish"); expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("手入力の保存失敗は成功扱いしない", async () => {
   const data=form(); data.delete("sourceUrl"); mock.rpc.mockResolvedValue({error:{message:"failed"}});
   await expect(createRecipe(data)).rejects.toThrow("error=save");
 });
 it("手入力は従来の保存先を使う", async () => { const data=form(); data.delete("sourceUrl"); await expect(createRecipe(data)).rejects.toThrow("created=household"); expect(mock.rpc.mock.calls[0][0]).toBe("save_household_recipe_editor"); });
});
