export const MONITOR_CAMPAIGN_CAPACITY = 10;

export type MonitorCampaignStatus = {
  capacity: number;
  claimed: number;
  remaining: number;
  isOpen: boolean;
  isAvailable: boolean;
};

export const unavailableMonitorCampaignStatus: MonitorCampaignStatus = {
  capacity: MONITOR_CAMPAIGN_CAPACITY,
  claimed: 0,
  remaining: 0,
  isOpen: false,
  isAvailable: false,
};

export function normalizeMonitorCampaignStatus(value: unknown): MonitorCampaignStatus {
  if (!value || typeof value !== "object") return unavailableMonitorCampaignStatus;
  const row = value as Record<string, unknown>;
  const capacity = typeof row.capacity === "number" ? row.capacity : MONITOR_CAMPAIGN_CAPACITY;
  const claimed = typeof row.claimed === "number" ? row.claimed : 0;
  const remaining = typeof row.remaining === "number" ? row.remaining : 0;
  const isOpen = row.is_open === true && remaining > 0;

  return {
    capacity: Math.max(0, capacity),
    claimed: Math.max(0, claimed),
    remaining: Math.max(0, remaining),
    isOpen,
    isAvailable: true,
  };
}
