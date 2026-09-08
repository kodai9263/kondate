export const breakfastKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export type BreakfastKey = (typeof breakfastKeys)[number];

export const defaultBreakfastChoices: BreakfastKey[] = ["A", "B", "C", "D"];

export function normalizeBreakfastChoices(value: unknown): BreakfastKey[] {
  if (!Array.isArray(value)) return [...defaultBreakfastChoices];
  const selected = new Set(value.filter((item): item is string => typeof item === "string"));
  return breakfastKeys.filter((key) => selected.has(key));
}
