import nodemailer from "nodemailer";
import { z } from "zod";

export type AppFeedbackCategory = "bug" | "improvement" | "praise";

const categoryLabels: Record<AppFeedbackCategory, string> = {
  bug: "不具合",
  improvement: "改善してほしい",
  praise: "良かった",
};

export function buildFeedbackEmail(input: { category: AppFeedbackCategory; message: string }) {
  const categoryLabel = categoryLabels[input.category];
  return {
    subject: `【きょうのごはん】${categoryLabel}のフィードバック`,
    text: [`種類: ${categoryLabel}`, "", "内容:", input.message].join("\n"),
  };
}

const emailAddress = z.string().trim().email();

export async function sendFeedbackEmail(input: { category: AppFeedbackCategory; message: string }): Promise<boolean> {
  const recipient = emailAddress.safeParse(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  if (!recipient.success) return false;
  const to = recipient.data;
  const email = buildFeedbackEmail(input);
  const provider = process.env.FEEDBACK_EMAIL_PROVIDER || "resend";
  if (provider === "smtp") return sendSmtpFeedback(to, email);
  if (provider !== "resend") return false;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FEEDBACK_NOTIFICATION_FROM?.trim() || "きょうのごはん <onboarding@resend.dev>",
        to: [to],
        subject: email.subject,
        text: email.text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendSmtpFeedback(to: string, email: ReturnType<typeof buildFeedbackEmail>): Promise<boolean> {
  const host = process.env.FEEDBACK_SMTP_HOST?.trim();
  const port = process.env.FEEDBACK_SMTP_PORT || "465";
  const user = process.env.FEEDBACK_SMTP_USER?.trim();
  const pass = process.env.FEEDBACK_SMTP_PASSWORD;
  const sender = emailAddress.safeParse(process.env.FEEDBACK_SMTP_FROM?.trim() || user);
  if (!host || !user || !pass || !sender.success || !["465", "587"].includes(port)) return false;

  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      requireTLS: true,
      auth: { user, pass },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      dnsTimeout: 5000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
    try {
      const result = await transport.sendMail({
        from: { name: "きょうのごはん", address: sender.data },
        to,
        ...email,
      });
      return result.accepted.some(address => address.toLowerCase() === to.toLowerCase());
    } finally {
      transport.close();
    }
  } catch {
    // 送信結果が不明な場合も別サービスへ再送しない。投稿本文は先にDBへ保存されている。
    return false;
  }
}
