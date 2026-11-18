import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { checkPasswordSafety } from "@/lib/auth/passwordSafety.server";
const password = "example-test-password";
const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
afterEach(() => vi.unstubAllGlobals());
describe("漏洩パスワード照合", () => {
  it("先頭5文字だけ送信し、平文・完全ハッシュを送らない", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(`${hash.slice(5)}:12\r\n${"A".repeat(35)}:0`));
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkPasswordSafety(password)).toBe("pwned");
    expect(fetchMock).toHaveBeenCalledWith(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, expect.objectContaining({ cache: "no-store", redirect: "error", headers: expect.objectContaining({ "Add-Padding": "true" }) }));
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(password);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(hash);
  });
  it("件数ゼロのパディングを漏洩と判定しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`${hash.slice(5)}:0`)));
    expect(await checkPasswordSafety(password)).toBe("safe");
  });
  it.each(["", "<html>error</html>", `${hash.slice(5)}:oops`])("不正応答を安全と判定しない", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    expect(await checkPasswordSafety(password)).toBe("unavailable");
  });
  it("通信失敗・HTTP失敗を安全と判定しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await checkPasswordSafety(password)).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    expect(await checkPasswordSafety(password)).toBe("unavailable");
  });
});
