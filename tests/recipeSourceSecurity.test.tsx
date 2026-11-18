import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/admin/recipe-sources" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("next/script", () => ({ default: ({ src, children }: { src?: string; children?: string }) => <script async src={src}>{children}</script> }));
import { GoogleAnalytics } from "@/components/features/analytics/GoogleAnalytics";
import config from "../next.config";
beforeEach(() => { route.path = "/admin/recipe-sources"; vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST12345"); });
describe("管理画面の追加保護", () => {
  it("管理画面ではアクセス解析を読み込まない", () => {
    expect(renderToStaticMarkup(<GoogleAnalytics />)).toBe("");
    route.path = "/app";
    expect(renderToStaticMarkup(<GoogleAnalytics />)).toContain("googletagmanager.com");
    vi.unstubAllEnvs();
  });
  it("管理画面のキャッシュ・埋め込み・外部通信を制限する", async () => {
    const routes = await config.headers!();
    const headers = Object.fromEntries(routes.find(route => route.source === "/admin/:path*")!.headers.map(header => [header.key, header.value]));
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("connect-src 'self'");
    expect(headers["Referrer-Policy"]).toBe("same-origin");
  });
});
