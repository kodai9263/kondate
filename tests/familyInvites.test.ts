import { describe, expect, it } from "vitest";
import { buildInviteUrl, normalizeInviteToken } from "@/lib/family/invites";

describe("family invites", () => {
  it("accepts uuid invite tokens", () => {
    expect(normalizeInviteToken(" 550e8400-e29b-41d4-a716-446655440000 ")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects unsafe invite token values", () => {
    expect(normalizeInviteToken("../secret")).toBeNull();
    expect(normalizeInviteToken("550e8400-e29b-41d4-a716-446655440000?x=1")).toBeNull();
    expect(normalizeInviteToken(null)).toBeNull();
  });

  it("builds an app invite URL", () => {
    expect(buildInviteUrl("550e8400-e29b-41d4-a716-446655440000")).toBe("http://localhost:3000/invite/550e8400-e29b-41d4-a716-446655440000");
  });
});
