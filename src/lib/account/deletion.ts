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

async function removeHouseholdImages(householdId: string) {
  const storage = getSupabaseAdmin().storage.from("recipe-images");
  const folders = [householdId];
  const paths: string[] = [];
  while (folders.length > 0) {
    const folder = folders.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.list(folder, { limit: 1000, offset });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) paths.push(path);
        else folders.push(path);
      }
      if (!data || data.length < 1000) break;
      offset += data.length;
    }
  }
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await storage.remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

async function processDeletion(row: DeletionRow): Promise<DeletionStatus> {
  const admin = getSupabaseAdmin();
  if (row.status === "completed") return { receipt: row.id, status: "completed" };
  if (!row.user_id) throw new Error("退会対象の認証情報を確認できませんでした。");
  if (!row.household_id) throw new Error("退会対象の家族情報を確認できませんでした。");

  if (row.status === "processing") {
    if (row.last_member) await removeHouseholdImages(row.household_id);
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
