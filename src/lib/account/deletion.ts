import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DeletionRow = {
  id: string;
  user_id: string | null;
  household_id: string | null;
  last_member: boolean;
  status: "processing" | "pending_auth" | "completed";
};

export type DeletionStatus = { receipt: string; status: "processing" | "completed" };

export function isStorageTransferRequired(cause: unknown) {
  return Boolean(cause && typeof cause === "object" && "message" in cause
    && typeof cause.message === "string" && cause.message.includes("storage_ownership_requires_transfer"));
}

// DBで確定した対象だけをStorage APIで削除する。管理テーブルは更新しない。
async function removeDeletionImages(receipt: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("account_deletion_requests").select("storage_objects").eq("id", receipt).single();
  if (error || !data || !Array.isArray(data.storage_objects)) throw new Error("写真の削除対象を確認できませんでした。");
  for (const object of data.storage_objects as Array<{ bucket: string; name: string }>) {
    const storage = admin.storage.from(object.bucket);
    const { data: url } = storage.getPublicUrl(object.name);
    // 先に参照を外す。途中失敗時も同じ受付番号で再試行できる。
    const { error: referenceError } = await admin.from("recipes").update({ image_url: null }).eq("image_url", url.publicUrl);
    if (referenceError) throw referenceError;
    const { error: removeError } = await storage.remove([object.name]);
    if (removeError) throw removeError;
  }
}

async function processDeletion(row: DeletionRow): Promise<DeletionStatus> {
  const admin = getSupabaseAdmin();
  if (row.status === "completed") return { receipt: row.id, status: "completed" };
  if (!row.user_id) throw new Error("退会対象の認証情報を確認できませんでした。");
  if (!row.household_id) throw new Error("退会対象の家族情報を確認できませんでした。");

  if (row.status === "processing") {
    await removeDeletionImages(row.id);
    const { error } = await admin.rpc("finish_account_deletion_data", { target_request_id: row.id });
    if (error) throw error;
  }

  const { error: authError } = await admin.auth.admin.deleteUser(row.user_id);
  if (authError && authError.status !== 404) throw authError;

  const { error: completeError } = await admin.rpc("complete_account_deletion", { target_request_id: row.id });
  if (completeError) throw completeError;
  return { receipt: row.id, status: "completed" };
}

export async function startAccountDeletion(userId: string): Promise<DeletionStatus> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("begin_account_deletion", { target_user_id: userId });
  if (error) throw error;
  const request = Array.isArray(data) ? data[0] : null;
  if (!request || typeof request.request_id !== "string") throw new Error("退会の受付を確認できませんでした。");
  const row: DeletionRow = {
    id: request.request_id,
    user_id: userId,
    household_id: request.household_id,
    last_member: request.last_member,
    status: request.status,
  };
  try { return await processDeletion(row); }
  catch (cause) {
    console.error("Account deletion processing failed", cause);
    return { receipt: row.id, status: "processing" };
  }
}

export async function resumeAccountDeletion(receipt: string): Promise<DeletionStatus | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("account_deletion_requests")
    .select("id,user_id,household_id,last_member,status").eq("id", receipt).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  try { return await processDeletion(data as DeletionRow); }
  catch (cause) {
    console.error("Account deletion retry failed", cause);
    return { receipt, status: "processing" };
  }
}

export async function getAccountDeletionStatus(receipt: string): Promise<DeletionStatus | null> {
  const { data, error } = await getSupabaseAdmin().from("account_deletion_requests")
    .select("status").eq("id", receipt).maybeSingle();
  if (error) throw error;
  return data ? { receipt, status: data.status === "completed" ? "completed" : "processing" } : null;
}
