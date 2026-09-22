import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/auth/session", () => ({
  hasAuthenticatedSession: async () => false,
  redirectIfAuthenticated: async () => undefined,
}));
vi.mock("@/lib/marketing/monitorCampaign.server", () => ({
  getMonitorCampaignStatus: () => { throw new Error("募集枠を参照してはいけません"); },
}));
vi.mock("@/app/(auth)/actions", () => ({ signup: async () => undefined }));
import MonitorPage from "@/app/monitor/page";
import SignupPage from "@/app/(auth)/signup/page";
import LandingPage from "@/app/page";
import { getCampaignFields } from "@/lib/marketing/campaignParams";

describe("募集導線を通常の無料登録へ統一", () => {
  it("旧募集ページは通常の紹介ページへ案内する", async () => {
    await expect(MonitorPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/");
  });
  it("旧募集リンクの流入元だけを保持し、募集指定や転送先を渡さない", async () => {
    await expect(MonitorPage({ searchParams: Promise.resolve({ utm_source: "ig", utm_medium: "social", source: "monitor", next: "https://example.test" }) })).rejects.toThrow("redirect:/?utm_source=ig&utm_medium=social");
    expect(getCampaignFields({ utm_source: [" ig ", "x"], email: "private", utm_content: "a".repeat(101) })).toEqual({ utm_source: "ig", utm_content: "a".repeat(100) });
  });
  it("紹介ページから通常登録へ流入元を引き継ぐ", async () => {
    const html = renderToStaticMarkup(await LandingPage({ searchParams: Promise.resolve({ utm_source: "ig" }) }));
    expect(html).toContain('href="/signup?utm_source=ig"');
    expect(html).not.toMatch(/モニター|先着10|14日間/);
  });
  it.each([undefined, "monitor-full", "monitor-unavailable"])("古い募集指定・募集エラーでも枠を参照せず通常登録する（%s）", async (error) => {
    const html = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({ source: "monitor", error, utm_source: "instagram" }) }));
    expect(html).not.toMatch(/モニター|残り10|14日間|受付を終了/);
    expect(html).not.toContain('name="signupSource"');
    expect(html).not.toContain('name="source"');
    expect(html).toContain('name="utm_source" value="instagram"');
    expect(html).toContain("無料アカウントを作る");
  });
  it("メール確認待ちは再登録させない", async () => {
    const html = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({ source: "monitor", success: "check-email" }) }));
    expect(html).toContain("メールをご確認ください");
    expect(html).not.toContain("<form");
  });
  it("家族の招待と通常の入力エラーは残す", async () => {
    const invite = "550e8400-e29b-41d4-a716-446655440000";
    const html = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({ invite, error: "invalid" }) }));
    expect(html).toContain(`name="inviteToken" value="${invite}"`);
    expect(html).toContain("入力内容を確認してください");
  });
});
