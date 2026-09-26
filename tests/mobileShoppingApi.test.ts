import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  canAccessHousehold: vi.fn(),
  getPlannedShopping: vi.fn(),
  getSavedShoppingState: vi.fn(),
  buildSnapshot: vi.fn(),
}));

vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));
vi.mock("@/lib/billing/entitlements", () => ({ canAccessHousehold: mocks.canAccessHousehold }));
vi.mock("@/lib/shopping/server", () => ({
  getPlannedShopping: mocks.getPlannedShopping,
  getSavedShoppingState: mocks.getSavedShoppingState,
}));
vi.mock("@/lib/shopping/mobileSnapshot", () => ({ buildMobileShoppingSnapshot: mocks.buildSnapshot }));

import { GET, OPTIONS } from "@/app/api/mobile/v1/shopping/route";

const token = "test-token-for-mobile-request";

function request(origin = "capacitor://localhost", authorization?: string) {
  return new Request("https://example.test/api/mobile/v1/shopping", {
    headers: { origin, ...(authorization ? { authorization } : {}) },
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
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) }, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue(fakeClient());
  mocks.canAccessHousehold.mockReturnValue(true);
  mocks.getPlannedShopping.mockResolvedValue({ householdId: "household-1" });
  mocks.getSavedShoppingState.mockResolvedValue({ checkedKeys: [] });
  mocks.buildSnapshot.mockReturnValue({ version: 1, householdId: "household-1" });
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
    expect(denied.status).toBe(403);
  });
});
