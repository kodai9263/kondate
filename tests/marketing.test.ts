import { describe, expect, it } from "vitest";
import { normalizeGoogleAnalyticsId } from "@/lib/analytics/googleAnalytics";
import { buildMonitorSignupHref } from "@/lib/marketing/campaignParams";
import { normalizeSignupSource } from "@/lib/marketing/signupSource";

describe("buildMonitorSignupHref", () => {
  it("広告のUTMをモニター登録ページまで引き継ぐ", () => {
    expect(buildMonitorSignupHref({ utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "monitor 202609" })).toEqual({
      pathname: "/signup",
      query: { source: "monitor", utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "monitor 202609" },
    });
  });

  it("UTM以外の値は登録URLへ引き継がない", () => {
    expect(buildMonitorSignupHref({ source: "unknown", redirect: "https://example.com" })).toEqual({ pathname: "/signup", query: { source: "monitor" } });
  });
});

describe("normalizeSignupSource", () => {
  it("モニター募集経由だけを受け付ける", () => {
    expect(normalizeSignupSource("monitor")).toBe("monitor");
    expect(normalizeSignupSource(" MONITOR ")).toBe("monitor");
  });

  it("不明な流入元や文字列以外を保存しない", () => {
    expect(normalizeSignupSource("advertisement")).toBeNull();
    expect(normalizeSignupSource(null)).toBeNull();
  });
});

describe("normalizeGoogleAnalyticsId", () => {
  it("正しいGA4測定IDを正規化する", () => {
    expect(normalizeGoogleAnalyticsId(" g-abc123 ")).toBe("G-ABC123");
  });

  it("不正な値では計測タグを読み込まない", () => {
    expect(normalizeGoogleAnalyticsId("UA-12345-1")).toBeNull();
    expect(normalizeGoogleAnalyticsId("G-ABC<script>")).toBeNull();
  });
});
