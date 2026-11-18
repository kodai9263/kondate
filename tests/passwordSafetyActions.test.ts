import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ safety: vi.fn(), signup: vi.fn(), update: vi.fn(), login: vi.fn(), getUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("@/lib/auth/session", () => ({ redirectIfAuthenticated: async () => {} }));
vi.mock("@/lib/auth/passwordSafety.server", () => ({ checkPasswordSafety: mock.safety }));
vi.mock("@/lib/billing/stripe", () => ({ getAppUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => true, getSupabaseServer: async () => ({ auth: { signUp: mock.signup, updateUser: mock.update, signInWithPassword: mock.login, getUser: mock.getUser }, rpc: async () => ({ error: null }) }) }));
import { signup, updatePassword, login } from "@/app/(auth)/actions";
function form() { const f = new FormData(); for (const [k,v] of Object.entries({ displayName: "検証", email: "test@example.test", password: "example-password" })) f.set(k,v); return f; }
beforeEach(() => { vi.clearAllMocks(); mock.safety.mockResolvedValue("safe"); mock.getUser.mockResolvedValue({ data: { user: { id: "test" } }, error: null }); mock.update.mockResolvedValue({ error: null }); mock.login.mockResolvedValue({ error: null }); });
describe("安全性確認前の認証変更を防ぐ", () => {
  it.each(["pwned", "unavailable"])("%sでは登録・更新を呼ばない", async state => {
    mock.safety.mockResolvedValue(state);
    await expect(signup(form())).rejects.toThrow(/password-/);
    await expect(updatePassword(form())).rejects.toThrow(/password-/);
    expect(mock.signup).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
  });
  it("確認成功時だけ更新する", async () => {
    await expect(updatePassword(form())).rejects.toThrow("password-updated");
    expect(mock.update).toHaveBeenCalledWith({ password: "example-password" });
  });
  it("未認証の再設定で外部照合しない", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(updatePassword(form())).rejects.toThrow("expired");
    expect(mock.safety).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
  });
  it("既存のログインを漏洩検査で妨げない", async () => {
    await expect(login(form())).rejects.toThrow("/app");
    expect(mock.safety).not.toHaveBeenCalled(); expect(mock.login).toHaveBeenCalled();
  });
});
