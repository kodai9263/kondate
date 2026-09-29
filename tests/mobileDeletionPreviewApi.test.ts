import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));

import { GET, OPTIONS } from "@/app/api/mobile/v1/account/deletion-preview/route";

const token = "test-token-for-mobile-request";

function request(origin = "capacitor://localhost", authorization?: string) {
  return new Request("https://example.test/api/mobile/v1/account/deletion-preview", {
    headers: { origin, ...(authorization ? { authorization } : {}) },
  });
}

function fakeClient(input: { members?: string[]; status?: string; stripe?: boolean; anonymous?: boolean } = {}) {
  const members = input.members ?? ["user-1", "user-2"];
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1", is_anonymous: input.anonymous ?? false } }, error: null })) },
    from: vi.fn((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: table === "profiles"
          ? { household_id: "household-1", display_name: "本人" }
          : { status: input.status ?? "free", current_period_end: null,
            stripe_customer_id: input.stripe ? "customer-1" : null }, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: members.map((id) => ({ id })), error: null }).then(resolve),
      };
      return chain;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue(fakeClient());
});

describe("スマホ向け退会前の確認API", () => {
  it("未認証・許可外の出所には家族情報を返さない", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("https://other.example", `Bearer ${token}`))).status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("無料プランの家族参加者も退会前の影響を確認できる", async () => {
    const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      version: 1,
      account: { displayName: "本人", isAnonymous: false },
      household: { memberCount: 2, lastMember: false },
      subscription: { active: false, provider: "none" },
    });
    expect(OPTIONS(request()).status).toBe(204);
  });

  it("最後の一人とStripe契約を区別して返す", async () => {
    mocks.createClient.mockReturnValue(fakeClient({ members: ["user-1"], status: "active", stripe: true }));
    const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      household: { memberCount: 1, lastMember: true },
      subscription: { active: true, provider: "stripe" },
    });
  });

  it("本人が家族の一覧にいない場合は詳細を返さない", async () => {
    mocks.createClient.mockReturnValue(fakeClient({ members: ["user-2"] }));
    expect((await GET(request("capacitor://localhost", `Bearer ${token}`))).status).toBe(503);
  });
});
