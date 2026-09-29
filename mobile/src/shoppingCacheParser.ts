import { isShoppingSnapshot, type ShoppingSnapshot } from "./shopping";

const maxAgeMs = 24 * 60 * 60 * 1000;

export type CachedShopping = {
  version: 1;
  userId: string;
  savedAt: string;
  snapshot: ShoppingSnapshot;
};

export function parseShoppingCache(raw: string | null, userId: string, now: number): ShoppingSnapshot | null {
  if (!raw) return null;
  let value: Partial<CachedShopping>;
  try { value = JSON.parse(raw) as Partial<CachedShopping>; }
  catch { return null; }
  if (value.version !== 1 || value.userId !== userId || !isShoppingSnapshot(value.snapshot)) return null;
  const savedAt = Date.parse(value.savedAt ?? "");
  const fetchedAt = Date.parse(value.snapshot.fetchedAt);
  if (!Number.isFinite(savedAt) || !Number.isFinite(fetchedAt) || fetchedAt > savedAt + 60_000
    || now < savedAt || now - Math.min(savedAt, fetchedAt) > maxAgeMs) return null;
  return value.snapshot;
}
