import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ start: vi.fn(), resume: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/account/deletion", () => ({
  startAccountDeletion: mocks.start, resumeAccountDeletion: mocks.resume,
  isStorageTransferRequired: (cause: unknown) => cause instanceof Error && cause.message.includes("storage_ownership_requires_transfer"),
}));
vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));

import { OPTIONS, POST } from "@/app/api/mobile/v1/account/deletion/route";

const receipt = "550e8400-e29b-41d4-a716-446655440000";
const token = "mobile-test-access-token";

function request(body: unknown, origin = "capacitor://localhost", authorization?: string) {
  return new Request("https://example.test/api/mobile/v1/account/deletion", {
    method: "POST", headers: { origin, "Content-Type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ACCOUNT_DELETION_ENABLED = "true";
  mocks.createClient.mockReturnValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) } });
  mocks.start.mockResolvedValue({ receipt, status: "completed" });
  mocks.resume.mockResolvedValue({ receipt, status: "processing" });
});

afterEach(() => { delete process.env.ACCOUNT_DELETION_ENABLED; });

describe("スマホ向け退会API", () => {
  it("未公開時は一切の削除処理を始めない", async () => {
    delete process.env.ACCOUNT_DELETION_ENABLED;
    expect((await POST(request({ action: "delete", confirmation: "削除" }, "capacitor://localhost", `Bearer ${token}`))).status).toBe(503);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("出所・本人確認・確認語を検証する", async () => {
    expect((await POST(request({ action: "delete", confirmation: "削除" }, "https://evil.example", `Bearer ${token}`))).status).toBe(403);
    expect((await POST(request({ action: "delete", confirmation: "削除" }))).status).toBe(401);
    expect((await POST(request({ action: "delete", confirmation: "はい" }, "capacitor://localhost", `Bearer ${token}`))).status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("認証された本人の退会を受け付ける", async () => {
    const response = await POST(request({ action: "delete", confirmation: "削除" }, "capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ version: 1, receipt, status: "completed" });
    expect(mocks.start).toHaveBeenCalledWith("user-1");
    expect(OPTIONS(request({})).status).toBe(204);
  });

  it("受付番号だけで処理状況を再確認できる", async () => {
    const response = await POST(request({ action: "status", receipt }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ version: 1, receipt, status: "processing" });
    expect(mocks.resume).toHaveBeenCalledWith(receipt);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("不正な受付番号をサーバー処理へ渡さない", async () => {
    expect((await POST(request({ action: "status", receipt: "../account" }))).status).toBe(400);
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("共有写真を安全に移せない場合は受付前に理由を返す", async () => {
    mocks.start.mockRejectedValue(new Error("storage_ownership_requires_transfer"));
    const response = await POST(request({ action: "delete", confirmation: "削除" }, "capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "deletion_requires_support" });
  });
});
