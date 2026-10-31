import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: mock.client }));
import { GET, POST } from "@/app/auth/confirm/route";
const hash = "1".repeat(64);
const url = `https://example.test/auth/confirm?token_hash=${hash}`;
function post(body = `token_hash=${hash}&next=/app`, origin = "https://example.test", cookie = "") {
  return new NextRequest("https://example.test/auth/confirm", { method: "POST", headers: { origin, cookie, "content-type": "application/x-www-form-urlencoded" }, body });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-signing-key");
  mock.verify.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-11-01" } }, error: null });
  mock.client.mockResolvedValue({ auth: { verifyOtp: mock.verify } });
});
describe("登録メールの確認", () => {
  it("リンクの先読みでは認証を消費しない", async () => {
    const response = await GET(new NextRequest(url));
    expect(await response.text()).toContain('method="post"');
    expect(mock.verify).not.toHaveBeenCalled();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("本人のボタン操作で確認し、同じリンクの再訪を成功として扱う", async () => {
    const response = await POST(post());
    expect(mock.verify).toHaveBeenCalledWith({ token_hash: hash, type: "email" });
    expect(response.status).toBe(303);
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const again = await GET(new NextRequest(url, { headers: { cookie } }));
    expect(await again.text()).toContain("メールアドレスの確認が完了しました");
    const another = await GET(new NextRequest(url.replace(hash, "2".repeat(64)), { headers: { cookie } }));
    expect(await another.text()).toContain("メールアドレスを確認する");
  });
  it("期限切れと認証済みを区別できない時は登録失敗と断定しない", async () => {
    mock.verify.mockResolvedValue({ data: { user: null }, error: { code: "otp_expired" } });
    const html = await (await POST(post())).text();
    expect(html).toContain("ログインをお試しください");
    expect(html).toContain("確認メールを再送");
    expect(html).not.toContain("確認が完了しました");
  });
  it("確認失敗時に既存のブラウザログインだけで成功扱いしない", async () => {
    mock.verify.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });
    expect(await (await POST(post())).text()).not.toContain("確認が完了しました");
  });
  it("不正な出所・トークンを拒否し、外部サイトへ戻さない", async () => {
    expect((await POST(post(undefined, "https://evil.test"))).status).toBe(403);
    await POST(post("token_hash=invalid"));
    expect(mock.verify).not.toHaveBeenCalled();
    const response = await POST(post(`token_hash=${hash}&next=https://evil.test`));
    expect(response.headers.get("location")).toContain("redirect_to=%2Fapp");
  });
});
