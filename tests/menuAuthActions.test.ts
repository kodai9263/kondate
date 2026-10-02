import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ signup: vi.fn(), login: vi.fn(), rpc: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/billing/stripe", () => ({ getAppUrl: () => "https://kondate.example.test" }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => true, getSupabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }), signUp: mock.signup, signInWithPassword: mock.login }, rpc: mock.rpc }) }));
import { signup, login } from "@/app/(auth)/actions";
const destination = "/app/planner/setup?recipe=official%3Agyudon";
function form(next = destination) { const data = new FormData(); data.set("displayName", "検証"); data.set("email", "user@example.test"); data.set("password", "test-only-password"); data.set("next", next); return data; }
beforeEach(() => { vi.clearAllMocks(); mock.signup.mockResolvedValue({ data: { session: null }, error: null }); mock.login.mockResolvedValue({ error: null }); mock.rpc.mockResolvedValue({ error: null }); });
describe("メニュー選択を登録後へ引き継ぐ", () => {
  it("メール確認URLに内部の料理選択先を保持する", async () => {
    await expect(signup(form())).rejects.toThrow("success=check-email");
    const call = mock.signup.mock.calls[0][0];
    expect(call.options.emailRedirectTo).toBe(`https://kondate.example.test/auth/callback?next=${encodeURIComponent(destination)}`);
  });
  it("登録後すぐログインできる場合も料理を引き継ぐ", async () => {
    mock.signup.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(signup(form())).rejects.toThrow(`redirect:${destination}`);
    expect(mock.rpc).toHaveBeenCalledWith("ensure_current_user_household");
  });
  it("既存アカウントのログインでも料理を引き継ぐ", async () => {
    await expect(login(form())).rejects.toThrow(`redirect:${destination}`);
  });
  it("ログインエラーの再入力でも料理を失わない", async () => {
    mock.login.mockResolvedValue({ error: { message: "invalid" } });
    await expect(login(form())).rejects.toThrow(`error=credentials&next=${encodeURIComponent(destination)}`);
  });
  it("外部URLをメール確認後の遷移先にしない", async () => {
    await expect(signup(form("//evil.example"))).rejects.toThrow("success=check-email");
    expect(mock.signup.mock.calls[0][0].options.emailRedirectTo).toBe("https://kondate.example.test/auth/callback?next=%2Fapp");
  });
});
