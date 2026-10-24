import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));
vi.mock("@/lib/family/invites", () => ({ buildInviteUrl: (token: string) => `https://example.test/invite/${token}` }));

import { DELETE, GET, OPTIONS, POST } from "@/app/api/mobile/v1/invites/route";

const token = "test-token-for-mobile-request";

function request(method: "GET" | "POST", origin = "capacitor://localhost", authorization?: string) {
  return new Request("https://example.test/api/mobile/v1/invites", {
    method, headers: { origin, ...(authorization ? { authorization } : {}) },
  });
}

function fakeClient(input: { anonymous?: boolean; status?: string } = {}) {
  const rpc = vi.fn(async () => ({ error: null }));
  const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: {
    id: "invite-1", invite_token: "token-1", expires_at: "2026-10-07T00:00:00Z",
  }, error: null }) }) }));
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain, gt: () => chain,
      order: () => chain,
      limit: async () => ({ data: [{ id: "invite-1", invite_token: "token-1", expires_at: "2026-10-07T00:00:00Z" }], error: null }),
      maybeSingle: async () => ({ data: table === "profiles" ? { household_id: "household-1" }
        : { status: input.status ?? "active", current_period_end: null }, error: null }),
      insert,
    };
    return chain;
  });
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1", is_anonymous: input.anonymous ?? false } }, error: null })) },
    from, insert, rpc,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue(fakeClient());
});

describe("スマホ向け家族招待API", () => {
  it("未認証・許可外の出所を拒否する", async () => {
    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request("POST", "https://other.example", `Bearer ${token}`))).status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("登録済みユーザーの招待リンクを読み取る", async () => {
    const response = await GET(request("GET", "capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ invites: [{ url: "https://example.test/invite/token-1" }] });
    expect(OPTIONS(request("GET")).status).toBe(204);
    expect(OPTIONS(request("GET")).headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("匿名参加者と無料プランから招待を作らない", async () => {
    const anonymous = fakeClient({ anonymous: true });
    mocks.createClient.mockReturnValue(anonymous);
    expect((await POST(request("POST", "capacitor://localhost", `Bearer ${token}`))).status).toBe(403);
    expect(anonymous.insert).not.toHaveBeenCalled();

    const free = fakeClient({ status: "free" });
    mocks.createClient.mockReturnValue(free);
    expect((await POST(request("POST", "capacitor://localhost", `Bearer ${token}`))).status).toBe(403);
    expect(free.insert).not.toHaveBeenCalled();
  });

  it("有効な家族プランの本人だけが招待を作る", async () => {
    const client = fakeClient();
    mocks.createClient.mockReturnValue(client);
    const response = await POST(request("POST", "capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ invite: { url: "https://example.test/invite/token-1" } });
    expect(client.insert).toHaveBeenCalledWith({ household_id: "household-1", created_by: "user-1" });
  });

  it("本人確認後に招待リンクを解除する", async () => {
    const client = fakeClient();
    mocks.createClient.mockReturnValue(client);
    const id = "4df384eb-6120-49c5-9927-7a9743626e6f";
    const response = await DELETE(new Request("https://example.test/api/mobile/v1/invites", {
      method: "DELETE", headers: { origin: "capacitor://localhost", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    }));
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("revoke_household_invite", { invite_id_input: id });
  });

  it("不正な招待IDは解除処理へ渡さない", async () => {
    const client = fakeClient();
    mocks.createClient.mockReturnValue(client);
    const response = await DELETE(new Request("https://example.test/api/mobile/v1/invites", {
      method: "DELETE", headers: { origin: "capacitor://localhost", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: "invalid" }),
    }));
    expect(response.status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
