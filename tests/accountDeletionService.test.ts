import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getAdmin }));

import { resumeAccountDeletion, startAccountDeletion } from "@/lib/account/deletion";

const receipt = "550e8400-e29b-41d4-a716-446655440000";
const household = "660e8400-e29b-41d4-a716-446655440000";

function fakeAdmin(input: { lastMember?: boolean; storageObjects?: Array<{ id: string; name: string }>; authError?: { status: number }; removeError?: boolean } = {}) {
  const storage = {
    list: vi.fn(async () => ({ data: input.storageObjects ?? [], error: null })),
    remove: vi.fn(async () => ({ error: input.removeError ? new Error("storage down") : null })),
    getPublicUrl: (name: string) => ({ data: { publicUrl: `https://example.test/${name}` } }),
  };
  const admin = {
    rpc: vi.fn(async (name: string) => ({ data: name === "begin_account_deletion" ? [{
      request_id: receipt, household_id: household, last_member: input.lastMember ?? false, status: "processing",
    }] : null, error: null })),
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: input.authError ?? null })) } },
    storage: { from: vi.fn(() => storage) },
    from: vi.fn((table: string) => table === "recipes"
      ? { update: () => ({ eq: vi.fn(async () => ({ error: null })) }) }
      : { select: () => ({ eq: () => ({
        single: async () => ({ data: { storage_objects: (input.storageObjects ?? []).map(file => ({ bucket: "recipe-images", name: `${household}/${file.name}` })) }, error: null }),
        maybeSingle: async () => ({ data: { id: receipt, user_id: "user-1", household_id: household, last_member: input.lastMember ?? false, status: "pending_auth" }, error: null }),
      }) }) }),
  };
  mocks.getAdmin.mockReturnValue(admin);
  return { admin, storage };
}

beforeEach(() => vi.clearAllMocks());

describe("退会処理", () => {
  it("家族が残る場合は共有写真を消さず本人の認証を削除する", async () => {
    const { admin, storage } = fakeAdmin();
    expect(await startAccountDeletion("user-1")).toEqual({ receipt, status: "completed" });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith("finish_account_deletion_data", { target_request_id: receipt });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(admin.rpc).toHaveBeenCalledWith("complete_account_deletion", { target_request_id: receipt });
  });

  it("最後の一人では保存写真を消してから共有データと認証を処理する", async () => {
    const { admin, storage } = fakeAdmin({ lastMember: true, storageObjects: [{ id: "file-1", name: "photo.jpg" }] });
    expect(await startAccountDeletion("user-1")).toEqual({ receipt, status: "completed" });

    expect(storage.remove).toHaveBeenCalledWith([`${household}/photo.jpg`]);
    expect(admin.rpc).toHaveBeenCalledWith("finish_account_deletion_data", { target_request_id: receipt });
  });

  it("家族が残っても本人所有の写真だけを削除する", async () => {
    const { storage } = fakeAdmin({ storageObjects: [{ id: "owned", name: "own.jpg" }] });
    expect((await startAccountDeletion("user-1")).status).toBe("completed");
    expect(storage.remove).toHaveBeenCalledWith([`${household}/own.jpg`]);
  });
  it("写真削除に失敗したら認証削除せず再試行待ちにする", async () => {
    const { admin } = fakeAdmin({ storageObjects: [{ id: "owned", name: "own.jpg" }], removeError: true });
    expect((await startAccountDeletion("user-1")).status).toBe("processing");
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
  it("認証削除が失敗しても受付番号を返し、再試行できる", async () => {
    const { admin } = fakeAdmin({ authError: { status: 503 } });
    expect(await startAccountDeletion("user-1")).toEqual({ receipt, status: "processing" });
    expect(await resumeAccountDeletion(receipt)).toEqual({ receipt, status: "processing" });
    expect(admin.rpc).not.toHaveBeenCalledWith("complete_account_deletion", expect.anything());
  });
  it("テスト対象外の受付番号では削除を再開しない", async () => {
    const { admin } = fakeAdmin();
    expect(await resumeAccountDeletion(receipt, ["another-user"])).toBeNull();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("テスト対象の受付番号だけ削除を再開できる", async () => {
    const { admin } = fakeAdmin();
    expect(await resumeAccountDeletion(receipt, ["user-1"])).toEqual({ receipt, status: "completed" });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
  });

});
