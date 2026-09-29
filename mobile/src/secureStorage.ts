import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const temporaryStorage = new Map<string, string>();

function installationId() {
  if (!Capacitor.isNativePlatform()) return "browser";
  const marker = "kondate-installation-id-v1";
  let value = localStorage.getItem(marker);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(marker, value);
  }
  return value;
}

// 再インストール後は別の保存名を使い、iOS Keychainに残る以前のデータを読み込まない。
export function installationStorageKey(name: string) {
  return `kondate-${name}-v1-${installationId()}`;
}

export const authStorageKey = installationStorageKey("auth");

// ブラウザでの開発時はメモリだけを使い、認証情報を平文で永続保存しない。
export const authStorage = Capacitor.isNativePlatform() ? {
  getItem: (key: string) => SecureStorage.getItem(key),
  setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
  removeItem: (key: string) => SecureStorage.removeItem(key),
} : {
  getItem: async (key: string) => temporaryStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { temporaryStorage.set(key, value); },
  removeItem: async (key: string) => { temporaryStorage.delete(key); },
};
