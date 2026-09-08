const signupSources = ["monitor"] as const;

export type SignupSource = (typeof signupSources)[number];

export function normalizeSignupSource(value: unknown): SignupSource | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return signupSources.find((source) => source === normalized) ?? null;
}
