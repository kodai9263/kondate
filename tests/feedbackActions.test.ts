import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ insert: vi.fn(), notify: vi.fn(), getUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/notifications/feedbackEmail", () => ({ sendFeedbackEmail: mock.notify }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({
    auth: { getUser: mock.getUser },
    from: (table: string) => table === "app_feedback" ? { insert: mock.insert } : {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { household_id: "household-test" } }) }) }),
    },
  }),
}));
import { submitAppFeedback } from "@/app/feedback/actions";

function feedback() {
  const form = new FormData();
  form.set("category", "improvement");
  form.set("message", "使いたい機能の提案です");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "user-test" } } });
  mock.insert.mockResolvedValue({ error: null });
  mock.notify.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe("フィードバックの保存と通知", () => {
  it("メール送信より先に投稿を保存する", async () => {
    await expect(submitAppFeedback(feedback())).rejects.toThrow("redirect:/account?feedback=thanks");
    expect(mock.insert).toHaveBeenCalledWith({
      household_id: "household-test", user_id: "user-test", category: "improvement", message: "使いたい機能の提案です",
    });
    expect(mock.insert.mock.invocationCallOrder[0]).toBeLessThan(mock.notify.mock.invocationCallOrder[0]);
  });

  it("メールが届かなくても保存済み投稿を受け付け済みとして扱う", async () => {
    mock.notify.mockResolvedValue(false);
    await expect(submitAppFeedback(feedback())).rejects.toThrow("redirect:/account?feedback=thanks");
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.notify).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("Feedback notification could not be delivered");
  });

  it("保存に失敗した投稿は送信しない", async () => {
    mock.insert.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(submitAppFeedback(feedback())).rejects.toThrow("redirect:/account?feedback=error");
    expect(mock.notify).not.toHaveBeenCalled();
  });

  it("未ログインの送信を拒否する", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    await expect(submitAppFeedback(feedback())).rejects.toThrow("redirect:/login");
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.notify).not.toHaveBeenCalled();
  });
});
