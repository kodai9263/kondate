"use server";

import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";

const taskStateSchema = z.object({
  planEntryId: z.string().uuid(),
  stepId: z.string().uuid(),
  checked: z.boolean(),
});

export async function setTodayTaskChecked(input: unknown): Promise<{ ok: boolean; checked?: boolean }> {
  const parsed = taskStateSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data, error } = await supabase.rpc("set_task_checked", {
    target_plan_entry_id: parsed.data.planEntryId,
    target_step_id: parsed.data.stepId,
    target_checked: parsed.data.checked,
  });

  if (error) return { ok: false };
  return { ok: true, checked: data === true };
}
