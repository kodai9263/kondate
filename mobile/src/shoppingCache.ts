import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { installationStorageKey } from "./secureStorage";
import { isShoppingSnapshot, type ShoppingSnapshot } from "./shopping";

const key = installationStorageKey("shopping-cache");
const maxAgeMs = 24 * 60 * 60 * 1000;

type CachedShopping = {
  version: 1;
  userId: string;
  savedAt: string;
  snapshot: ShoppingSnapshot;
};

export async function saveShoppingCache(userId: string, snapshot: ShoppingSnapshot) {
  if (!Capacitor.isNativePlatform()) return;
  const value: CachedShopping = { version: 1, userId, savedAt: new Date().toISOString(), snapshot };
  await SecureStorage.setItem(key, JSON.stringify(value));
}

export async function loadShoppingCache(userId: string): Promise<ShoppingSnapshot | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const raw = await SecureStorage.getItem(key);
  return parseShoppingCache(raw, userId, Date.now());
}

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

export async function clearShoppingCache() {
  if (Capacitor.isNativePlatform()) await SecureStorage.removeItem(key);
}
