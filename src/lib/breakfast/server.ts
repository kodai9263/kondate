import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { breakfastSettingsSchema, type BreakfastVersion } from "./settings";

export const getBreakfastVersions = cache(async (): Promise<{ versions: BreakfastVersion[]; error: boolean }> => {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.from("household_breakfast_versions")
      .select("revision,effective_date,rotation_start,legacy_rotation,enabled,items").order("effective_date", { ascending: true });
    if (error || !data?.length) return { versions: [], error: true };
    const versions = data.map((row) => ({ ...row, ...breakfastSettingsSchema.parse({ enabled: row.enabled, items: row.items }) })) as BreakfastVersion[];
    return { versions, error: false };
  } catch {
    return { versions: [], error: true };
  }
});
