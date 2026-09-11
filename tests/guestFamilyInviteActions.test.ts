import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), signInAnonymously: vi.fn(), rpc: vi.fn(), preview: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({ auth: { getUser: mocks.getUser, signInAnonymously: mocks.signInAnonymously }, rpc: mocks.rpc }),
}));
import { acceptFamilyInvite } from "@/app/invite/[token]/actions";
import { revokeFamilyInvite } from "@/app/account/actions";

const token = "550e8400-e29b-41d4-a716-446655440000";
function form(name = "inviteToken", value = token) {
  const data = new FormData();
  data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.preview.mockResolvedValue({ data: { household_name: "わが家" }, error: null });
  mocks.signInAnonymously.mockResolvedValue({ data: { user: { id: "guest" }, session: {} }, error: null });
  mocks.rpc.mockImplementation((name: string) => name === "get_household_invite"
    ? { maybeSingle: mocks.preview } : Promise.resolve({ error: null }));
});

describe("登録なしの家族参加", () => {
  it("有効な招待で端末のセッションを作って参加する", async () => {
    await expect(acceptFamilyInvite(form())).rejects.toThrow("redirect:/app?notice=family-joined");
    expect(mocks.signInAnonymously).toHaveBeenCalledWith({ options: { data: { family_invite_token: token } } });
    expect(mocks.rpc).toHaveBeenLastCalledWith("accept_household_invite", { invite_token_input: token });
  });
  it("不正なトークンでは認証やDBへ進まない", async () => {
    await expect(acceptFamilyInvite(form("inviteToken", "../account"))).rejects.toThrow("redirect:/");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: "offline" } }])("使えない招待では端末アカウントを作らない", async (preview) => {
    mocks.preview.mockResolvedValue(preview);
    await expect(acceptFamilyInvite(form())).rejects.toThrow(`redirect:/invite/${token}?error=accept`);
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });
  it("匿名認証が無効・失敗なら参加済みと表示しない", async () => {
    mocks.signInAnonymously.mockResolvedValue({ data: { user: null, session: null }, error: { message: "disabled" } });
    await expect(acceptFamilyInvite(form())).rejects.toThrow(`redirect:/invite/${token}?error=guest`);
    expect(mocks.rpc).not.toHaveBeenCalledWith("accept_household_invite", expect.anything());
  });
  it("セッションが作れなかった場合も参加画面に戻す", async () => {
    mocks.signInAnonymously.mockResolvedValue({ data: { user: { id: "guest" }, session: null }, error: null });
    await expect(acceptFamilyInvite(form())).rejects.toThrow(`redirect:/invite/${token}?error=guest`);
  });
  it.each([false, true])("既存の登録済み・匿名アカウントを置き換えない (%s)", async (isAnonymous) => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "existing", is_anonymous: isAnonymous } } });
    await expect(acceptFamilyInvite(form())).rejects.toThrow("redirect:/app?notice=family-joined");
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });
  it("参加RPCの失敗時は招待リンクを維持して再試行できる", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "existing" } } });
    mocks.rpc.mockResolvedValue({ error: { message: "revoked" } });
    await expect(acceptFamilyInvite(form())).rejects.toThrow(`redirect:/invite/${token}?error=accept`);
  });
});

describe("共有解除", () => {
  it("未ログインでは解除しない", async () => {
    await expect(revokeFamilyInvite(form("inviteId"))).rejects.toThrow("redirect:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("匿名参加者は解除できない", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "guest", is_anonymous: true } } });
    await expect(revokeFamilyInvite(form("inviteId"))).rejects.toThrow("redirect:/account?error=registered");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("登録済みの招待者はDBで権限を確認して解除する", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner", is_anonymous: false } } });
    await expect(revokeFamilyInvite(form("inviteId"))).rejects.toThrow("redirect:/account?success=revoked");
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_household_invite", { invite_id_input: token });
  });
  it("権限不足やDB失敗を成功として扱わない", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "other" } } });
    mocks.rpc.mockResolvedValue({ error: { message: "invite not found" } });
    await expect(revokeFamilyInvite(form("inviteId"))).rejects.toThrow("redirect:/account?error=revoke");
  });
});
