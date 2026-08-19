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

export async function sendFeedbackEmail(input: { category: AppFeedbackCategory; message: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  if (!apiKey || !to) return false;

  const email = buildFeedbackEmail(input);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FEEDBACK_NOTIFICATION_FROM ?? "きょうのごはん <onboarding@resend.dev>",
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
