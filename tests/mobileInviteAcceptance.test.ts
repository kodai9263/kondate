import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inviteTokenFromUrl } from "../mobile/src/inviteLinks";
import { joinFamilyInvite, previewFamilyInvite } from "../mobile/src/inviteAcceptance";

const token = "f14460f1-446c-4e95-98ec-11a43425e7d1";
describe("アプリへの招待リンク", () => {
  it.each([
    `https://kondate-bay.vercel.app/invite/${token}`,
    `https://kondate-bay.vercel.app/invite/${token}?utm_source=line`,
    `kyounogohan://invite/${token}`,
    `kyounogohan://invite/${token.toUpperCase()}/`,
  ])("正しいリンクを受け取る: %s", url => expect(inviteTokenFromUrl(url)).toBe(token));
  it.each([
    `https://evil.example/invite/${token}`, `http://kondate-bay.vercel.app/invite/${token}`,
    `https://kondate-bay.vercel.app.evil.example/invite/${token}`,
    `https://user:password@kondate-bay.vercel.app/invite/${token}`,
    `kyounogohan://other/${token}`, `kyounogohan://invite/${token}/extra`,
    `kyounogohan://invite/${token}#other`, `javascript:alert(1)`, "not-a-link",
    "https://kondate-bay.vercel.app/invite/invalid", `kyounogohan://invite:123/${token}`,
  ])("無関係なリンクを拒否する: %s", url => expect(inviteTokenFromUrl(url)).toBeNull());
});

const getSession = vi.fn();
const signInAnonymously = vi.fn();
const preview = vi.fn();
const accept = vi.fn();
const client = {
  auth: { getSession, signInAnonymously },
  rpc: vi.fn((name: string) => name === "get_household_invite" ? { maybeSingle: preview } : accept()),
} as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: "existing" } } }, error: null });
  preview.mockResolvedValue({ data: { household_name: "家族" }, error: null });
  accept.mockResolvedValue({ data: "household-id", error: null });
  signInAnonymously.mockResolvedValue({ data: { session: { user: { id: "guest" } } }, error: null });
});

describe("アプリでの家族参加", () => {
  it("既存アカウントのセッションで参加し、新しい匿名ユーザーを作らない", async () => {
    await joinFamilyInvite(client, token);
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith("accept_household_invite", { invite_token_input: token });
  });
  it("未ログインでは招待を確認してから匿名参加する", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await joinFamilyInvite(client, token);
    expect(preview).toHaveBeenCalledOnce();
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { data: { family_invite_token: token } } });
    expect(accept).toHaveBeenCalledOnce();
  });
  it("期限切れの招待では匿名ユーザーを作らない", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    preview.mockResolvedValue({ data: null, error: null });
    await expect(joinFamilyInvite(client, token)).rejects.toThrow("期限切れ");
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
  });
  it("認証の失敗を参加成功にしない", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signInAnonymously.mockResolvedValue({ data: { session: null }, error: new Error("offline") });
    await expect(joinFamilyInvite(client, token)).rejects.toThrow("参加できませんでした");
    expect(accept).not.toHaveBeenCalled();
  });
  it("参加RPCで失効・消費済みと判断された場合は失敗を返す", async () => {
    accept.mockResolvedValue({ data: null, error: new Error("expired") });
    await expect(joinFamilyInvite(client, token)).rejects.toThrow("参加できませんでした");
  });
  it("セッション確認に失敗した場合は匿名参加に切り替えない", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: new Error("storage") });
    await expect(joinFamilyInvite(client, token)).rejects.toThrow("ログイン状態");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
  it("プレビューの不正な応答を拒否する", async () => {
    preview.mockResolvedValue({ data: { household_name: 5 }, error: null });
    await expect(previewFamilyInvite(client, token)).rejects.toThrow("招待リンク");
  });
});
