import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { installationStorageKey } from "./secureStorage";

const settingsKey = installationStorageKey("reminders");

export type Reminder = { enabled: boolean; weekday: number; time: string };
export type ReminderSettings = { shopping: Reminder; preparation: Reminder };

export const defaultReminderSettings: ReminderSettings = {
  shopping: { enabled: false, weekday: 6, time: "10:00" },
  preparation: { enabled: false, weekday: 0, time: "18:00" },
};

export function remindersAvailable() {
  return Capacitor.isNativePlatform();
}

function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Reminder>;
  return typeof item.enabled === "boolean" && Number.isInteger(item.weekday)
    && item.weekday! >= 0 && item.weekday! <= 6
    && typeof item.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time);
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  if (!remindersAvailable()) return defaultReminderSettings;
  const value = await SecureStorage.get(settingsKey);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultReminderSettings;
  const settings = value as Partial<ReminderSettings>;
  return isReminder(settings.shopping) && isReminder(settings.preparation)
    ? { shopping: settings.shopping, preparation: settings.preparation }
    : defaultReminderSettings;
}

function weeklySchedule(reminder: Reminder) {
  const [hour, minute] = reminder.time.split(":").map(Number);
  return { on: { weekday: reminder.weekday + 1, hour, minute } };
}

async function schedule(settings: ReminderSettings) {
  await LocalNotifications.cancelAll();
  const notifications: LocalNotificationSchema[] = [];
  if (settings.shopping.enabled) notifications.push({
    id: 4101, title: "きょうのごはん", body: "買い物リストを確認しましょう",
    schedule: weeklySchedule(settings.shopping), extra: { tab: "shopping" },
    isExactNotification: false,
  });
  if (settings.preparation.enabled) notifications.push({
    id: 4102, title: "きょうのごはん", body: "今日の段取りを確認しましょう",
    schedule: weeklySchedule(settings.preparation), extra: { tab: "today" },
    isExactNotification: false,
  });
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

export async function saveReminderSettings(settings: ReminderSettings) {
  if (!remindersAvailable()) throw new Error("通知はスマホアプリで設定できます。");
  if (!isReminder(settings.shopping) || !isReminder(settings.preparation)) throw new Error("通知の日時を確認してください。");
  if (settings.shopping.enabled || settings.preparation.enabled) {
    const current = await LocalNotifications.checkPermissions();
    const permission = current.display === "granted" ? current : await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") throw new Error("通知が許可されていません。端末の設定で許可してください。");
  }
  await schedule(settings);
  await SecureStorage.set(settingsKey, settings);
}

export async function renewReminderSchedules() {
  if (!remindersAvailable()) return;
  const settings = await loadReminderSettings();
  if (!settings.shopping.enabled && !settings.preparation.enabled) return;
  if ((await LocalNotifications.checkPermissions()).display === "granted") await schedule(settings);
}

export async function clearReminderSettings() {
  if (!remindersAvailable()) return;
  await LocalNotifications.cancelAll();
  await SecureStorage.remove(settingsKey);
}
