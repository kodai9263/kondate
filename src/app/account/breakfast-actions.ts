"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { breakfastSettingsSchema } from "@/lib/breakfast/settings";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function saveBreakfastSettings(input: unknown): Promise<
  { ok: true; revision: string; effectiveDate: string; changed: boolean } | { ok: false; error: string }
> {
  const parsed = z.object({ revision: z.string().uuid(), settings: breakfastSettingsSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "入力内容を確認してください。朝食は10件まで、名前は80文字以内で入力できます。" };
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.rpc("save_household_breakfast", {
      expected_revision: parsed.data.revision,
      settings: parsed.data.settings,
    });
    if (error || !data) return { ok: false, error: error?.message.includes("breakfast_conflict")
      ? "家族が設定を変更しました。入力内容を控えてから、再読み込みして最新の内容を確認してください。"
      : "朝食を保存できませんでした。入力は残っています。通信状態や利用権限を確認して、もう一度お試しください。" };
    revalidatePath("/account");
    revalidatePath("/app");
    revalidatePath("/app/shopping");
    return { ok: true, revision: data.revision, effectiveDate: data.effectiveDate, changed: data.changed };
  } catch {
    return { ok: false, error: "朝食を保存できませんでした。入力は残っています。もう一度お試しください。" };
  }
}
