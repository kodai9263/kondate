const measurementIdPattern = /^G-[A-Z0-9]+$/;

export function normalizeGoogleAnalyticsId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return measurementIdPattern.test(normalized) ? normalized : null;
}
