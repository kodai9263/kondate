import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), rpc: vi.fn(), adminRpc: vi.fn(), getUser: vi.fn(), configured: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/billing/stripe", () => ({ getAppUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: mocks.configured,
  getSupabaseServer: async () => ({ auth: { signUp: mocks.signUp, getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.adminRpc }) }));
import { signup } from "@/app/(auth)/actions";
import { buildSignupReturnHref } from "@/lib/marketing/campaignParams";

const invite = "550e8400-e29b-41d4-a716-446655440000";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ displayName: "テスト", email: "test@example.test", password: "password-test", signupSource: "monitor", utm_source: "instagram", utm_medium: "paid_social", inviteToken: invite })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.adminRpc.mockResolvedValue({ data: true, error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("モニター登録の導線", () => {
  it("入力エラーでも流入元・招待を維持し、枠を消費しない", async () => {
    const data = form(); data.set("password", "short");
    await expect(signup(data)).rejects.toThrow(`redirect:${buildSignupReturnHref(data, { error: "invalid" })}`);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it.each([[false, null, "monitor-full"], [null, { code: "error", message: "unavailable" }, "monitor-unavailable"]])("枠を確保できなければ登録しない", async (claimed, error, reason) => {
    mocks.adminRpc.mockResolvedValue({ data: claimed, error });
    const data = form();
    await expect(signup(data)).rejects.toThrow(`redirect:${buildSignupReturnHref(data, { error: String(reason) })}`);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("確認メール待ちでもモニター・広告・招待の文脈を保つ", async () => {
    const data = form();
    await expect(signup(data)).rejects.toThrow(`redirect:${buildSignupReturnHref(data, { success: "check-email" })}`);
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: expect.objectContaining({ signup_source: "monitor", monitor_claim_token: expect.any(String) }), emailRedirectTo: `https://example.test/auth/callback?next=/invite/${invite}` }) }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("登録失敗なら確保した枠を返却する", async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { message: "failed" } });
    const data = form();
    await expect(signup(data)).rejects.toThrow(`redirect:${buildSignupReturnHref(data, { error: "signup" })}`);
    const token = mocks.adminRpc.mock.calls[0][1].reservation_token;
    expect(mocks.adminRpc).toHaveBeenLastCalledWith("release_monitor_trial_slot", { reservation_token: token });
  });
  it("ログイン済みなら重複登録も枠の確保もしない", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "existing" } } });
    await expect(signup(form())).rejects.toThrow("redirect:/app");
    expect(mocks.adminRpc).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("即時ログインできた登録はアプリへ進む", async () => {
    const data = form(); data.delete("inviteToken");
    mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(signup(data)).rejects.toThrow("redirect:/app");
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_current_user_household");
  });
  it("復帰URLに個人情報や任意の転送先を含めない", () => {
    const data = form(); data.set("redirect", "https://evil.test"); data.set("utm_campaign", "a".repeat(200));
    const url = new URL(buildSignupReturnHref(data, { error: "invalid" }), "https://example.test");
    expect(url.pathname).toBe("/signup");
    expect(Object.fromEntries(url.searchParams)).toEqual({ source: "monitor", invite, utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "a".repeat(100), error: "invalid" });
  });
  it("一般登録をモニター登録へ変えない", async () => {
    const data = form(); data.delete("signupSource"); data.delete("inviteToken");
    await expect(signup(data)).rejects.toThrow("success=check-email");
    expect(mocks.adminRpc).not.toHaveBeenCalled();
    expect(mocks.signUp.mock.calls[0][0].options.data).toEqual({ display_name: "テスト" });
  });
});
