import { afterEach, describe, expect, it, vi } from "vitest";
import { canDeleteAccount, deletionTestUserIds } from "@/lib/account/deletion-access";
const id = "77e681c4-bbe9-4a8a-a629-e9a6f0ff2fad";
afterEach(() => vi.unstubAllEnvs());
describe("退会のテスト対象制限", () => {
  it("一般OFFでは許可IDだけが退会できる", () => {
    vi.stubEnv("ACCOUNT_DELETION_ENABLED", "false");
    vi.stubEnv("ACCOUNT_DELETION_TEST_USER_IDS", ` ${id} `);
    expect(canDeleteAccount(id)).toBe(true);
    expect(canDeleteAccount("another-user")).toBe(false);
  });
  it("不正な設定や空の設定では誰も許可しない", () => {
    vi.stubEnv("ACCOUNT_DELETION_ENABLED", "false");
    vi.stubEnv("ACCOUNT_DELETION_TEST_USER_IDS", "*,user@example.com,,");
    expect(deletionTestUserIds()).toEqual([]);
    expect(canDeleteAccount(id)).toBe(false);
  });
});
