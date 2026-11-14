import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
const mock = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: mock.client }));
import { GET, POST } from "@/app/auth/recovery/route";
const token = "a".repeat(64);
function post(body = `token_hash=${token}`, origin = "https://example.test") {
  return new NextRequest("https://example.test/auth/recovery", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.verify.mockResolvedValue({ data: { user: { id: "recovery-user" }, session: { access_token: "test" } }, error: null });
  mock.client.mockResolvedValue({ auth: { verifyOtp: mock.verify } });
});
describe("メールアプリからのパスワード再設定", () => {
  it("メールの先読みではトークンを消費せず、安全な確認ページだけ表示する", async () => {
    const response = await GET();
    expect(await response.text()).toContain("confirmationHash");
    expect(mock.client).not.toHaveBeenCalled();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("申込元のCookieなしでrecoveryトークンを検証し、固定の再設定画面へ進む", async () => {
    const response = await POST(post(`token_hash=${token}&next=https://evil.test&type=email`));
    expect(mock.verify).toHaveBeenCalledWith({ token_hash: token, type: "recovery" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/reset-password");
  });
  it("別サイトからの送信、不正トークン、大きすぎる入力を検証前に拒否する", async () => {
    expect((await POST(post(undefined, "https://evil.test"))).status).toBe(403);
    expect((await POST(post("token_hash=invalid"))).status).toBe(400);
    expect((await POST(post("x".repeat(4097)))).status).toBe(400);
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it("期限切れ・使用済みでは、既存ログインに頼らず再送を案内する", async () => {
    mock.verify.mockResolvedValue({ data: { user: null, session: null }, error: { code: "otp_expired" } });
    const response = await POST(post());
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("再設定メールを送る");
    expect(response.headers.get("location")).toBeNull();
  });
  it("認証サービス障害を期限切れと誤表示しない", async () => {
    mock.verify.mockRejectedValue(new Error("offline"));
    expect((await POST(post())).status).toBe(503);
  });
  it("メールはトークンをフラグメントに入れ、ブラウザ依存のコード交換を使わない", () => {
    const template = readFileSync("supabase/templates/recovery.html", "utf8");
    expect(template).toContain("/auth/recovery#token_hash={{ .TokenHash }}");
    expect(template).not.toContain(".ConfirmationURL");
  });
});
