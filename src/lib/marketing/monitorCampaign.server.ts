import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeMonitorCampaignStatus, unavailableMonitorCampaignStatus } from "@/lib/marketing/monitorCampaign";

export async function getMonitorCampaignStatus() {
  if (!isSupabaseConfigured()) return unavailableMonitorCampaignStatus;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("get_monitor_campaign_status").single();
  if (error) {
    console.error("Monitor campaign status lookup failed", { code: error.code, message: error.message });
    return unavailableMonitorCampaignStatus;
  }

  return normalizeMonitorCampaignStatus(data);
}
