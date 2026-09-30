"use server";

import { redirect } from "next/navigation";
import { isStorageTransferRequired, resumeAccountDeletion, startAccountDeletion } from "@/lib/account/deletion";
import { getSupabaseServer } from "@/lib/supabase/server";

const receiptPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requestAccountDeletion(formData: FormData) {
  if (process.env.ACCOUNT_DELETION_ENABLED !== "true") redirect("/account/delete?error=unavailable");
  if (formData.get("confirmation") !== "削除") redirect("/account/delete?error=confirmation");
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  let receipt: string;
  try { receipt = (await startAccountDeletion(user.id)).receipt; }
  catch (cause) {
    if (!isStorageTransferRequired(cause)) console.error("Web account deletion request failed", cause);
    redirect(isStorageTransferRequired(cause) ? "/account/delete?error=storage" : "/account/delete?error=failed");
  }
  await supabase.auth.signOut();
  redirect(`/account/deletion-status?receipt=${receipt}`);
}

export async function retryAccountDeletion(formData: FormData) {
  const receipt = formData.get("receipt");
  if (typeof receipt !== "string" || !receiptPattern.test(receipt)) redirect("/account/deletion-status");
  if (process.env.ACCOUNT_DELETION_ENABLED === "true") {
    try { await resumeAccountDeletion(receipt); }
    catch (cause) { console.error("Web account deletion retry failed", cause); }
  }
  redirect(`/account/deletion-status?receipt=${receipt}`);
}
