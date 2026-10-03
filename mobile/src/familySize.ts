export type FamilySizeSettings = { version: 1; adultCount: number; childCount: number };

function parseFamilySize(value: unknown): FamilySizeSettings {
  if (!value || typeof value !== "object") throw new Error("家族の人数を確認できませんでした。");
  const settings = value as Partial<FamilySizeSettings>;
  if (settings.version !== 1 || !Number.isInteger(settings.adultCount) || !Number.isInteger(settings.childCount)
    || (settings.adultCount ?? 0) < 1 || (settings.adultCount ?? 0) > 10
    || (settings.childCount ?? -1) < 0 || (settings.childCount ?? -1) > 10) {
    throw new Error("家族の人数を確認できませんでした。");
  }
  return settings as FamilySizeSettings;
}

async function requestFamilySize(accessToken: string, method: "GET" | "PATCH", input?: { adultCount: number; childCount: number }) {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const response = await fetch(`${apiBase}/api/mobile/v1/account/family-size`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`,
      ...(input ? { "Content-Type": "application/json" } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}), cache: "no-store",
  });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  if (response.status === 400) throw new Error("大人は1〜10人、子どもは0〜10人で入力してください。");
  if (!response.ok) throw new Error("家族の人数を保存・確認できませんでした。接続を確認してください。");
  return parseFamilySize(await response.json());
}

export function loadFamilySize(accessToken: string) {
  return requestFamilySize(accessToken, "GET");
}

export function saveFamilySize(accessToken: string, adultCount: number, childCount: number) {
  return requestFamilySize(accessToken, "PATCH", { adultCount, childCount });
}
