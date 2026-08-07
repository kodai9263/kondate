import { getAppUrl } from "@/lib/billing/stripe";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeInviteToken(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return uuidPattern.test(token) ? token : null;
}

export function buildInviteUrl(token: string) {
  return `${getAppUrl()}/invite/${token}`;
}
