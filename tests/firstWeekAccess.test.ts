import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ anonymous: false, status: "free", subscriptionError: null as unknown, trialError: null as unknown, freeTrial: null as { started_at: string; expires_at: string } | null, end: null as string | null }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user", is_anonymous: mock.anonymous } }, error: null }) },
  from: (table: string) => {
    const result = () => table === "profiles" ? { data: { household_id: "home" }, error: null } : table === "household_subscriptions" ? { data: { status: mock.status, current_period_end: mock.end }, error: mock.subscriptionError } : table === "household_free_trials" ? { data: mock.freeTrial, error: mock.trialError } : { data: null, error: mock.trialError };
    const query = { select: () => query, eq: () => query, single: async () => result(), maybeSingle: async () => result() };
    return query;
  },
}) }));
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
beforeEach(() => { mock.anonymous = false; mock.status = "free"; mock.subscriptionError = null; mock.trialError = null; mock.end = null; mock.freeTrial = null; });
describe("献立と買い物の利用権限", () => {
  it("状態取得に失敗した場合、有料や無料体験を付与しない", async () => {
    mock.trialError = { message: "missing migration" };
    await expect(getFirstWeekAccess()).rejects.toThrow("first_week_access_unavailable");
  });
  it("有効な家族プランでは既存のゲストが引き続き使える", async () => {
    mock.anonymous = true; mock.status = "active";
    expect((await getFirstWeekAccess()).paid).toBe(true);
  });
  it("期限切れのゲストに無料体験を付与しない", async () => {
    mock.anonymous = true; mock.status = "trialing"; mock.end = "2000-01-01T00:00:00Z";
    await expect(getFirstWeekAccess()).rejects.toThrow("first_week_auth_required");
  });
  it("チェックアウト完了だけでは有料判定にしない", async () => {
    mock.status = "checkout_completed";
    expect((await getFirstWeekAccess()).paid).toBe(false);
  });
});

it("登録中の無料体験は有料契約にせず献立・買い物だけを許可する", async () => {
  mock.freeTrial = { started_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 1000).toISOString() };
  const access = await getFirstWeekAccess();
  expect(access.paid).toBe(false); expect(access.canPlan).toBe(true); expect(access.trialActive).toBe(true);
});
it("期限切れの無料体験は停止し、再登録や設定の操作を要求しない", async () => {
  mock.freeTrial = { started_at: "2000-01-01T00:00:00Z", expires_at: "2000-01-15T00:00:00Z" };
  const access = await getFirstWeekAccess();
  expect(access.canPlan).toBe(false); expect(access.trialActive).toBe(false);
});
it("期限切れの無料体験より有効な契約を優先する", async () => {
  mock.status = "active";
  mock.freeTrial = { started_at: "2000-01-01T00:00:00Z", expires_at: "2000-01-15T00:00:00Z" };
  expect((await getFirstWeekAccess()).canPlan).toBe(true);
});
