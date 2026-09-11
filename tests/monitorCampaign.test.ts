import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MONITOR_CAMPAIGN_CAPACITY, normalizeMonitorCampaignStatus, unavailableMonitorCampaignStatus } from "@/lib/marketing/monitorCampaign";

const migrationSource = readFileSync("supabase/migrations/202609090032_monitor_trial_campaign.sql", "utf8");
const signupActionSource = readFileSync("src/app/(auth)/actions.ts", "utf8");
const monitorPageSource = readFileSync("src/app/monitor/page.tsx", "utf8");
const accountPageSource = readFileSync("src/app/account/page.tsx", "utf8");

describe("normalizeMonitorCampaignStatus", () => {
  it("DBの受付状況を画面用に正規化する", () => {
    expect(normalizeMonitorCampaignStatus({ capacity: 10, claimed: 6, remaining: 4, is_open: true })).toEqual({
      capacity: 10,
      claimed: 6,
      remaining: 4,
      isOpen: true,
      isAvailable: true,
    });
  });

  it("満枠と取得失敗では受付を閉じる", () => {
    expect(normalizeMonitorCampaignStatus({ capacity: 10, claimed: 10, remaining: 0, is_open: true }).isOpen).toBe(false);
    expect(normalizeMonitorCampaignStatus(null)).toEqual(unavailableMonitorCampaignStatus);
  });
});

describe("monitor trial migration", () => {
  it("先着枠を排他制御し、14日間だけ家族プランを開放する", () => {
    expect(MONITOR_CAMPAIGN_CAPACITY).toBe(10);
    expect(migrationSource).toContain("pg_advisory_xact_lock");
    expect(migrationSource).toContain("occupied_slots >= 10");
    expect(migrationSource).toContain("interval '14 days'");
    expect(migrationSource).toContain("status = 'trialing'");
    expect(migrationSource).toContain("plan_id = 'family_monthly'");
    expect(migrationSource).toContain("grant execute on function public.claim_monitor_trial_slot(uuid) to service_role");
    expect(migrationSource).toContain("grant execute on function public.release_monitor_trial_slot(uuid) to service_role");
  });

  it("期限切れ予約を除外し、公開APIは集計値だけを返す", () => {
    expect(migrationSource).toContain("expires_at <= now()");
    expect(migrationSource).toContain("get_monitor_campaign_status");
    expect(migrationSource).toContain("grant execute on function public.get_monitor_campaign_status() to anon, authenticated, service_role");
  });

  it("登録前に枠を予約し、登録失敗時は予約を解放する", () => {
    expect(signupActionSource.indexOf("reserveMonitorTrialSlot")).toBeLessThan(signupActionSource.indexOf("supabase.auth.signUp"));
    expect(signupActionSource).toContain("monitor_claim_token");
    expect(signupActionSource).toContain("releaseMonitorTrialSlot");
  });

  it("募集ページとアカウント画面に期間と自動課金なしを表示する", () => {
    expect(monitorPageSource).toContain("残り${monitorStatus.remaining}家庭");
    expect(monitorPageSource).toContain("14日間無料");
    expect(accountPageSource).toContain("終了後は自動課金されず、無料プランへ戻ります");
  });

  it("募集ページは主CTAを一本化し、スマホで常に登録へ進める", () => {
    expect(monitorPageSource).toContain("無料で14日間試す");
    expect(monitorPageSource).toContain('placement: "mobile_sticky"');
    expect(monitorPageSource).toContain("safe-area-inset-bottom");
    expect(monitorPageSource).not.toContain("monitor_demo_click");
  });
});
