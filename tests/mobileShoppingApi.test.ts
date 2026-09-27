import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  canAccessHousehold: vi.fn(),
  getPlannedShopping: vi.fn(),
  getSavedShoppingState: vi.fn(),
  buildSnapshot: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));
vi.mock("@/lib/billing/entitlements", () => ({ canAccessHousehold: mocks.canAccessHousehold }));
vi.mock("@/lib/shopping/server", () => ({
  getPlannedShopping: mocks.getPlannedShopping,
  getSavedShoppingState: mocks.getSavedShoppingState,
}));
vi.mock("@/lib/shopping/mobileSnapshot", () => ({ buildMobileShoppingSnapshot: mocks.buildSnapshot }));

import { GET, OPTIONS, PATCH } from "@/app/api/mobile/v1/shopping/route";

const token = "test-token-for-mobile-request";
const check = {
  weekStart: "2026-09-20", rangeStart: "2026-09-20", rangeEnd: "2026-09-26", periodMode: "week",
  item: { source: "auto", category: "肉", name: "planned-v1:current", position: 0, checked: true },
};

function request(origin = "capacitor://localhost", authorization?: string) {
  return new Request("https://example.test/api/mobile/v1/shopping", {
    headers: { origin, ...(authorization ? { authorization } : {}) },
  });
}

function patchRequest(body: unknown = check, authorization = `Bearer ${token}`, origin = "capacitor://localhost") {
  return new Request("https://example.test/api/mobile/v1/shopping", {
    method: "PATCH", headers: { origin, authorization, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

function fakeClient() {
  const data = {
    profiles: [{ household_id: "household-1" }, { id: "user-1" }],
    household_subscriptions: [{ status: "active", current_period_end: null }],
  };
  const from = vi.fn((table: keyof typeof data) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => ({ data: data[table]?.[0], error: null }),
      maybeSingle: async () => ({ data: table === "profiles" ? data.profiles[1] : data[table]?.[0], error: null }),
    };
    return chain;
  });
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) }, from, rpc: mocks.rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue(fakeClient());
  mocks.canAccessHousehold.mockReturnValue(true);
  mocks.getPlannedShopping.mockResolvedValue({ householdId: "household-1",
    period: { storageWeekStart: check.weekStart, start: check.rangeStart, end: check.rangeEnd, mode: check.periodMode },
    groups: [{ category: "肉", items: [check.item] }],
  });
  mocks.getSavedShoppingState.mockResolvedValue({ checkedKeys: [], manualItems: [] });
  mocks.buildSnapshot.mockReturnValue({ version: 1, householdId: "household-1" });
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("スマホ向け買い物API", () => {
  it("認証なしでは家族のデータを読み出さない", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getPlannedShopping).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("許可していない出所を拒否する", async () => {
    const response = await GET(request("https://other.example", `Bearer ${token}`));
    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("家族利用権がない場合は買い物データを返さない", async () => {
    mocks.canAccessHousehold.mockReturnValue(false);
    const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(403);
    expect(mocks.getPlannedShopping).not.toHaveBeenCalled();
  });

  it("確認済みの利用者だけに保存用スナップショットを返す", async () => {
    const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, householdId: "household-1" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    expect(mocks.getPlannedShopping).toHaveBeenCalledWith(expect.any(Object), token);
  });

  it("端末からの認証付き事前確認だけを通す", () => {
    const allowed = OPTIONS(request());
    const denied = OPTIONS(request("https://other.example"));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(allowed.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(denied.status).toBe(403);
  });

  it("未認証や家族利用権のない利用者のチェックを保存しない", async () => {
    expect((await PATCH(patchRequest(check, "invalid"))).status).toBe(401);
    mocks.canAccessHousehold.mockReturnValue(false);
    expect((await PATCH(patchRequest())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("許可外の出所と不正な入力を保存しない", async () => {
    expect((await PATCH(patchRequest(check, `Bearer ${token}`, "https://other.example"))).status).toBe(403);
    expect((await PATCH(patchRequest({ ...check, item: { ...check.item, position: -1 } }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("古い期間や集計結果にない品目を拒否する", async () => {
    expect((await PATCH(patchRequest({ ...check, rangeEnd: "2026-09-27" }))).status).toBe(409);
    expect((await PATCH(patchRequest({ ...check, item: { ...check.item, name: "planned-v1:old" } }))).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("現在の品目だけを既存の保存処理で更新する", async () => {
    const response = await PATCH(patchRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("update_planned_shopping", expect.objectContaining({
      target_week_start: check.weekStart, expected_range_end: check.rangeEnd,
      operation: "check", item: check.item,
    }));
    expect(mocks.getSavedShoppingState).toHaveBeenCalledTimes(1);
  });

  it("別端末との競合では保存済みと表示しない", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false }, error: null });
    const response = await PATCH(patchRequest());
    expect(response.status).toBe(409);
    expect(mocks.buildSnapshot).not.toHaveBeenCalled();
  });
});
