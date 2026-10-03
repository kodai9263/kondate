import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));

import { GET, OPTIONS, PATCH } from "@/app/api/mobile/v1/account/family-size/route";

const token = "test-token-for-mobile-request";
const url = "https://example.test/api/mobile/v1/account/family-size";

function request(method: "GET" | "PATCH", body?: unknown, origin = "capacitor://localhost", authorized = true) {
  return new Request(url, { method, headers: { origin, ...(authorized ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

function fakeClient(input: { settingsError?: boolean; profile?: boolean } = {}) {
  const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single: async () => ({
    data: input.settingsError ? null : { adult_count: 2, child_count: 1 },
    error: input.settingsError ? { message: "denied" } : null,
  }) }) }) }));
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: table === "profiles"
        ? input.profile === false ? null : { household_id: "household-1" }
        : { adult_count: 2, child_count: 3 }, error: null }),
      update,
    };
    return chain;
  });
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) }, from, update };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue(fakeClient());
});

describe("スマホ向け家族人数API", () => {
  it("未認証と許可外の出所を拒否する", async () => {
    expect((await GET(request("GET", undefined, "capacitor://localhost", false))).status).toBe(401);
    expect((await PATCH(request("PATCH", { adultCount: 0, childCount: 1 }, "capacitor://localhost", false))).status).toBe(401);
    expect((await PATCH(request("PATCH", { adultCount: 2, childCount: 1 }, "https://other.example"))).status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("家族の現在の人数を読み取る", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ version: 1, adultCount: 2, childCount: 3 });
    expect(OPTIONS(request("GET")).headers.get("access-control-allow-methods")).toContain("PATCH");
  });

  it("本人の家族の人数と分量計算用人数だけを保存する", async () => {
    const client = fakeClient();
    mocks.createClient.mockReturnValue(client);
    const response = await PATCH(request("PATCH", { adultCount: 2, childCount: 1 }));
    expect(response.status).toBe(200);
    expect(client.update).toHaveBeenCalledWith({ adult_count: 2, child_count: 1, default_servings: 3 });
    expect(await response.json()).toEqual({ version: 1, adultCount: 2, childCount: 1 });
  });

  it("範囲外や小数の人数はDBへ渡さない", async () => {
    const client = fakeClient();
    mocks.createClient.mockReturnValue(client);
    expect((await PATCH(request("PATCH", { adultCount: 0, childCount: 1 }))).status).toBe(400);
    expect((await PATCH(request("PATCH", { adultCount: 2, childCount: 1.5 }))).status).toBe(400);
    expect(client.update).not.toHaveBeenCalled();
  });

  it("家族情報がない場合とDBが拒否した場合は成功としない", async () => {
    mocks.createClient.mockReturnValue(fakeClient({ profile: false }));
    expect((await GET(request("GET"))).status).toBe(403);
    mocks.createClient.mockReturnValue(fakeClient({ settingsError: true }));
    expect((await PATCH(request("PATCH", { adultCount: 2, childCount: 1 }))).status).toBe(503);
  });
});
