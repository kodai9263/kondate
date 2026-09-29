import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { installationStorageKey } from "./secureStorage";
import { parseShoppingCache, type CachedShopping } from "./shoppingCacheParser";
import type { ShoppingSnapshot } from "./shopping";

const key = installationStorageKey("shopping-cache");

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

export async function clearShoppingCache() {
  if (Capacitor.isNativePlatform()) await SecureStorage.removeItem(key);
}
