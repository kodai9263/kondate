import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signupValidationMessage } from "../mobile/src/signupValidation";
const mock = vi.hoisted(() => ({ exchange: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => true, getSupabaseServer: mock.client }));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => {
  vi.clearAllMocks();
  mock.exchange.mockResolvedValue({ error: null }); mock.rpc.mockResolvedValue({ error: null });
  mock.client.mockResolvedValue({ auth: { exchangeCodeForSession: mock.exchange }, rpc: mock.rpc });
});
describe("アプリの新規登録", () => {
  it("確認用の入力が違えば登録を止める", () => {
    expect(signupValidationMessage("利用者", "valid-password", "different-password")).toContain("一致していません");
    expect(signupValidationMessage("利用者", "valid-password", "")).toContain("一致していません");
  });
  it("一致していても短いパスワードや空の表示名は拒否する", () => {
    expect(signupValidationMessage("利用者", "short", "short")).not.toBeNull();
    expect(signupValidationMessage(" ", "valid-password", "valid-password")).not.toBeNull();
    expect(signupValidationMessage("利用者", "valid-password", "valid-password")).toBeNull();
  });
});
describe("メール確認後のブラウザ", () => {
  it("コードがないアプリの確認リンクをWebログイン失敗にしない", async () => {
    const response = await GET(new NextRequest("https://example.test/auth/callback?next=/app"));
    expect(response.status).toBe(200);
    expect(mock.client).not.toHaveBeenCalled();
    const html = await response.text();
    expect(html).toContain("アプリへ戻って");
    expect(html).toContain("history.replaceState");
    expect(html).not.toContain("googletagmanager");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("WebのPKCEリンクは引き続きコードを交換する", async () => {
    const response = await GET(new NextRequest("https://example.test/auth/callback?code=web-code&next=/app"));
    expect(mock.exchange).toHaveBeenCalledWith("web-code");
    expect(response.headers.get("location")).toBe("https://example.test/app");
  });
  it("Webのコード交換失敗を成功と扱わない", async () => {
    mock.exchange.mockResolvedValue({ error: new Error("invalid") });
    const response = await GET(new NextRequest("https://example.test/auth/callback?code=invalid&next=/app"));
    expect(response.headers.get("location")).toContain("error=callback");
  });
});
