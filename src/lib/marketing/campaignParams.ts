const campaignParamNames = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized ? normalized.slice(0, 100) : null;
}

export function buildMonitorSignupHref(searchParams: SearchParams) {
  const query: Record<string, string> = { source: "monitor" };

  for (const name of campaignParamNames) {
    const value = firstValue(searchParams[name]);
    if (value) query[name] = value;
  }

  return { pathname: "/signup", query };
}
