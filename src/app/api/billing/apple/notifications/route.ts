import { verifyAppleNotification } from "@/lib/billing/apple/verification";
import { persistAppleTransaction } from "@/lib/billing/apple/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 60_000) return new Response(null, { status: 413 });
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || !("signedPayload" in body) || typeof body.signedPayload !== "string") return new Response(null, { status: 400 });
    const { transaction } = await verifyAppleNotification(body.signedPayload);
    if (transaction) await persistAppleTransaction(transaction);
    return new Response(null, { status: 200 });
  } catch {
    // 署名や個人情報をログに残さない。保存失敗時はAppleに再送を求める。
    return new Response(null, { status: 503 });
  }
}
