import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFeedbackEmail, sendFeedbackEmail } from "@/lib/notifications/feedbackEmail";

const smtp = vi.hoisted(() => ({ createTransport: vi.fn(), sendMail: vi.fn(), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));

describe("buildFeedbackEmail", () => {
  it("種類と本文を通知用テキストへ変換する", () => {
    expect(buildFeedbackEmail({ category: "bug", message: "保存ボタンが反応しません" })).toEqual({
      subject: "【きょうのごはん】不具合のフィードバック",
      text: "種類: 不具合\n\n内容:\n保存ボタンが反応しません",
    });
  });

  it("改善要望の表示名を日本語にする", () => {
    expect(buildFeedbackEmail({ category: "improvement", message: "並び替えたい" }).subject).toContain("改善してほしい");
  });
});

describe("sendFeedbackEmail", () => {
  const input = { category: "bug" as const, message: "保存ボタンが反応しません" };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ["FEEDBACK_EMAIL_PROVIDER", "FEEDBACK_SMTP_HOST", "FEEDBACK_SMTP_PORT", "FEEDBACK_SMTP_USER", "FEEDBACK_SMTP_PASSWORD", "FEEDBACK_SMTP_FROM", "RESEND_API_KEY", "FEEDBACK_NOTIFICATION_FROM", "NEXT_PUBLIC_SUPPORT_EMAIL"]) {
      vi.stubEnv(key, "");
    }
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.test");
    vi.stubGlobal("fetch", fetchMock);
    smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail, close: smtp.close });
    smtp.sendMail.mockResolvedValue({ accepted: ["support@example.test"] });
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  function configureSmtp() {
    vi.stubEnv("FEEDBACK_EMAIL_PROVIDER", "smtp");
    vi.stubEnv("FEEDBACK_SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("FEEDBACK_SMTP_USER", "sender@example.test");
    vi.stubEnv("FEEDBACK_SMTP_PASSWORD", "test-only-password");
  }

  it("SMTPで日本語の投稿内容を専用の宛先へ送る", async () => {
    configureSmtp();
    expect(await sendFeedbackEmail(input)).toBe(true);
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com", port: 465, secure: true, requireTLS: true,
      auth: { user: "sender@example.test", pass: "test-only-password" },
      tls: { minVersion: "TLSv1.2" }, disableFileAccess: true, disableUrlAccess: true,
    }));
    expect(smtp.sendMail).toHaveBeenCalledWith({
      from: { name: "きょうのごはん", address: "sender@example.test" },
      to: "support@example.test", ...buildFeedbackEmail(input),
    });
    expect(smtp.close).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("587番ポートでも暗号化を必須にする", async () => {
    configureSmtp();
    vi.stubEnv("FEEDBACK_SMTP_PORT", "587");
    vi.stubEnv("FEEDBACK_SMTP_FROM", "mail@example.test");
    await sendFeedbackEmail(input);
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, requireTLS: true }));
    expect(smtp.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: { name: "きょうのごはん", address: "mail@example.test" } }));
  });

  it.each([
    ["FEEDBACK_SMTP_PASSWORD", ""],
    ["FEEDBACK_SMTP_HOST", ""],
    ["FEEDBACK_SMTP_USER", ""],
    ["FEEDBACK_SMTP_PORT", "25"],
    ["FEEDBACK_SMTP_FROM", "sender@example.test\r\nBcc: other@example.test"],
    ["NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.test,other@example.test"],
    ["FEEDBACK_EMAIL_PROVIDER", "unknown"],
  ])("不完全・不正な設定 %s では外部送信しない", async (key, value) => {
    configureSmtp();
    vi.stubEnv(key, value);
    expect(await sendFeedbackEmail(input)).toBe(false);
    expect(smtp.createTransport).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("送信結果が不明でも二重送信せず接続を閉じる", async () => {
    configureSmtp();
    vi.stubEnv("RESEND_API_KEY", "test-only-resend-key");
    smtp.sendMail.mockRejectedValueOnce(new Error("connection lost"));
    expect(await sendFeedbackEmail(input)).toBe(false);
    expect(smtp.sendMail).toHaveBeenCalledOnce();
    expect(smtp.close).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("宛先が受け付けられなかった場合は成功扱いにしない", async () => {
    configureSmtp();
    smtp.sendMail.mockResolvedValueOnce({ accepted: [] });
    expect(await sendFeedbackEmail(input)).toBe(false);
    expect(smtp.close).toHaveBeenCalledOnce();
  });

  it("接続の初期化に失敗しても投稿処理へ例外を漏らさない", async () => {
    configureSmtp();
    smtp.createTransport.mockImplementationOnce(() => { throw new Error("transport setup failed"); });
    expect(await sendFeedbackEmail(input)).toBe(false);
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("切り替え前は従来のResend送信を維持する", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only-resend-key");
    fetchMock.mockResolvedValueOnce({ ok: true });
    expect(await sendFeedbackEmail(input)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: ["support@example.test"], ...buildFeedbackEmail(input) });
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
});
