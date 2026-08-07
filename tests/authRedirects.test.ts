import { describe, expect, it } from "vitest";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";

describe("getSafeAuthRedirect", () => {
  it("アプリ内のパスだけを許可する", () => {
    expect(getSafeAuthRedirect("/reset-password")).toBe("/reset-password");
    expect(getSafeAuthRedirect("/app?notice=done")).toBe("/app?notice=done");
  });

  it("外部URLと空値はアプリへ戻す", () => {
    expect(getSafeAuthRedirect("https://example.com")).toBe("/app");
    expect(getSafeAuthRedirect("//example.com")).toBe("/app");
    expect(getSafeAuthRedirect(null)).toBe("/app");
  });
});
