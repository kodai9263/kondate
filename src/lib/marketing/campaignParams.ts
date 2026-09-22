import { normalizeInviteToken } from "@/lib/family/invites";
import { normalizeSignupSource } from "@/lib/marketing/signupSource";

const campaignParamNames = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized ? normalized.slice(0, 100) : null;
}

export function getCampaignFields(searchParams: SearchParams) {
  const query: Record<string, string> = {};

  for (const name of campaignParamNames) {
    const value = firstValue(searchParams[name]);
    if (value) query[name] = value;
  }

  return query;
}

export function buildMonitorSignupHref(searchParams: SearchParams) {
  return { pathname: "/signup", query: { source: "monitor", ...getCampaignFields(searchParams) } };
}

export function buildSignupReturnHref(formData: FormData, result: { error: string } | { success: string }) {
  const query = new URLSearchParams();
  const source = normalizeSignupSource(formData.get("signupSource"));
  const invite = normalizeInviteToken(formData.get("inviteToken"));
  if (source) query.set("source", source);
  if (invite) query.set("invite", invite);
  for (const name of campaignParamNames) {
    const input = formData.get(name);
    const value = typeof input === "string" ? firstValue(input) : null;
    if (value) query.set(name, value);
  }
  for (const [name, value] of Object.entries(result)) query.set(name, value);
  return `/signup?${query.toString()}` as const;
}
