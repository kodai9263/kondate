import { describe, expect, it, vi } from "vitest";
import { registerMobileContext, getMobileContext, getMobileSettings } from "../src/lib/mobile/context";

describe("モバイルのリクエスト内共有", () => {
  function client() {
    const read = vi.fn().mockResolvedValue({ data: { adult_count: 2 }, error: null });
    const fake = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }) };
    return { fake: fake as unknown as Parameters<typeof registerMobileContext>[0], read };
  }
  it("未認証のクライアントには共有情報を与えない", () => {
    const { fake } = client(); expect(getMobileContext(fake)).toBeUndefined();
    expect(() => getMobileSettings(fake)).toThrow("mobile_context_required");
  });
  it("同時取得は一度だけ実行し、別リクエストや家族へ共有しない", async () => {
    const first = client(), second = client();
    const user = { id: "user" } as Parameters<typeof registerMobileContext>[1]["user"];
    registerMobileContext(first.fake, { user, householdId: "one", subscription: null });
    registerMobileContext(second.fake, { user, householdId: "two", subscription: null });
    await Promise.all([getMobileSettings(first.fake), getMobileSettings(first.fake), getMobileSettings(second.fake)]);
    expect(first.read).toHaveBeenCalledTimes(1); expect(second.read).toHaveBeenCalledTimes(1);
    expect(getMobileContext(second.fake)?.householdId).toBe("two");
  });
});
