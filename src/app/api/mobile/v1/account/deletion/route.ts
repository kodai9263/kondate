import { isStorageTransferRequired, resumeAccountDeletion, startAccountDeletion } from "@/lib/account/deletion";
import { mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

const receiptPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false || origin === null) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: {
    ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "600",
  } });
}

export async function POST(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  if (process.env.ACCOUNT_DELETION_ENABLED !== "true") return mobileJsonError("deletion_unavailable", 503, origin);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return mobileJsonError("invalid_request", 400, origin);

  let body: unknown;
  try { body = await request.json(); }
  catch { return mobileJsonError("invalid_request", 400, origin); }
  if (!body || typeof body !== "object") return mobileJsonError("invalid_request", 400, origin);
  const input = body as { action?: unknown; confirmation?: unknown; receipt?: unknown };

  if (input.action === "status") {
    if (typeof input.receipt !== "string" || !receiptPattern.test(input.receipt)) {
      return mobileJsonError("invalid_receipt", 400, origin);
    }
    try {
      const status = await resumeAccountDeletion(input.receipt);
      if (!status) return mobileJsonError("receipt_not_found", 404, origin);
      return Response.json({ version: 1, ...status }, {
        status: status.status === "completed" ? 200 : 202, headers: mobileResponseHeaders(origin),
      });
    } catch (cause) {
      console.error("Account deletion status failed", cause);
      return mobileJsonError("deletion_unavailable", 503, origin);
    }
  }

  if (input.action !== "delete" || input.confirmation !== "削除") {
    return mobileJsonError("confirmation_required", 400, origin);
  }
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/)?.[1];
  if (!token) return mobileJsonError("unauthenticated", 401, origin);
  try {
    const { data: { user }, error } = await createMobileRequestClient(token).auth.getUser(token);
    if (error || !user) return mobileJsonError("unauthenticated", 401, origin);
    const status = await startAccountDeletion(user.id);
    return Response.json({ version: 1, ...status }, {
      status: status.status === "completed" ? 200 : 202, headers: mobileResponseHeaders(origin),
    });
  } catch (cause) {
    if (isStorageTransferRequired(cause)) return mobileJsonError("deletion_requires_support", 409, origin);
    console.error("Account deletion request failed", cause);
    return mobileJsonError("deletion_unavailable", 503, origin);
  }
}
