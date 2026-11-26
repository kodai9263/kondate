import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/.well-known/assetlinks.json/route";

afterEach(() => vi.unstubAllEnvs());
describe("Androidの関連付け", () => {
  it("署名未設定では架空の証明書を公開しない", async () => {
    vi.stubEnv("ANDROID_APP_LINK_SHA256_FINGERPRINTS", "");
    expect(await GET().json()).toEqual([]);
  });
  it("正しいSHA256だけを指定したパッケージに関連付ける", async () => {
    const fingerprint = Array(32).fill("ab").join(":");
    vi.stubEnv("ANDROID_APP_LINK_SHA256_FINGERPRINTS", `invalid, ${fingerprint}`);
    expect(await GET().json()).toEqual([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "app.kyounogohan.mobile", sha256_cert_fingerprints: [fingerprint.toUpperCase()] },
    }]);
  });
});
