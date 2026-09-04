export type ShoppingBroadcastItem = {
  id: string;
  category: string;
  name: string;
  position: number;
  checked: boolean;
  dismissed?: boolean;
  source: "auto" | "manual";
  eventType: "INSERT" | "UPDATE" | "DELETE";
};

type BroadcastPayload = {
  event?: unknown;
  payload?: {
    eventType?: unknown;
    record?: Record<string, unknown>;
    old_record?: Record<string, unknown>;
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  };
};

export function getShoppingBroadcastRecord(payload: unknown): ShoppingBroadcastItem | null {
  const message = payload as BroadcastPayload;
  const rawEvent = message.event ?? message.payload?.eventType ?? "UPDATE";
  const eventType = typeof rawEvent === "string" ? rawEvent.toUpperCase() : "UPDATE";
  if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") return null;

  const body = message.payload;
  const record = eventType === "DELETE"
    ? body?.old_record ?? body?.old ?? body?.record
    : body?.record ?? body?.new;

  if (
    typeof record?.id !== "string"
    || typeof record.category !== "string"
    || typeof record.name !== "string"
    || typeof record.checked !== "boolean"
    || (record.source !== "auto" && record.source !== "manual")
  ) return null;

  const position = Number(record.position ?? 0);
  if (!Number.isFinite(position)) return null;

  return {
    id: record.id,
    category: record.category,
    name: record.name,
    position,
    checked: record.checked,
    ...(typeof record.dismissed === "boolean" ? { dismissed: record.dismissed } : {}),
    source: record.source,
    eventType,
  };
}
