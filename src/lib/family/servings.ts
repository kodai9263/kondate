export type FamilySize = {
  adultCount: number;
  childCount: number;
};

export const defaultFamilySize: FamilySize = { adultCount: 2, childCount: 3 };
export const childServingRatio = 0.6;
export const defaultShoppingDay = 6;
export const shoppingWeekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;

const quantityPattern = String.raw`(?:\d+\/\d+|\d+(?:\.\d+)?)`;
const postfixUnits = "kg|ml|切れ|パック|カップ|個|本|枚|袋|缶|瓶|箱|丁|株|房|束|玉|斤|かけ|L|g";

export function normalizeFamilySize(value?: Partial<FamilySize> | null): FamilySize {
  const adultCount = Number.isInteger(value?.adultCount) ? Number(value?.adultCount) : defaultFamilySize.adultCount;
  const childCount = Number.isInteger(value?.childCount) ? Number(value?.childCount) : defaultFamilySize.childCount;
  return {
    adultCount: Math.min(10, Math.max(1, adultCount)),
    childCount: Math.min(10, Math.max(0, childCount)),
  };
}

export function normalizeShoppingDay(value: unknown) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 0 && day <= 6 ? day : defaultShoppingDay;
}

export function formatShoppingDay(value: unknown) {
  return shoppingWeekdays[normalizeShoppingDay(value)];
}

export function getAdultEquivalent({ adultCount, childCount }: FamilySize) {
  return adultCount + childCount * childServingRatio;
}

export function getFamilyScale(familySize: FamilySize) {
  return getAdultEquivalent(familySize) / getAdultEquivalent(defaultFamilySize);
}

export function formatFamilyLabel({ adultCount, childCount }: FamilySize) {
  return childCount > 0 ? `大人${adultCount}人・子ども${childCount}人` : `大人${adultCount}人`;
}

export function formatServingLabel(familySize: FamilySize) {
  const equivalent = formatDecimal(getAdultEquivalent(familySize));
  return `${formatFamilyLabel(familySize)}（${equivalent}人前相当）`;
}

export function scaleQuantityText(text: string, familySize: FamilySize) {
  const scale = getFamilyScale(familySize);
  if (Math.abs(scale - 1) < 0.001) return text;

  const withPostfixUnits = text.replace(
    new RegExp(`(${quantityPattern})\\s*(${postfixUnits})`, "g"),
    (_match, raw: string, unit: string) => `${formatScaledQuantity(parseQuantity(raw), unit, scale, raw.includes("/"))}${unit}`,
  );

  return withPostfixUnits.replace(
    new RegExp(`(大さじ|小さじ)(${quantityPattern})`, "g"),
    (_match, unit: string, raw: string) => `${unit}${formatQuarterQuantity(parseQuantity(raw) * scale)}`,
  );
}

function parseQuantity(raw: string) {
  if (!raw.includes("/")) return Number(raw);
  const [numerator, denominator] = raw.split("/").map(Number);
  return numerator / denominator;
}

function formatScaledQuantity(value: number, unit: string, scale: number, wasFraction: boolean) {
  const scaled = value * scale;
  if (unit === "g" || unit === "ml") return String(Math.max(10, Math.ceil(scaled / 10) * 10));
  if (unit === "kg" || unit === "L") return formatDecimal(Math.max(0.1, Math.ceil(scaled * 10) / 10));
  if (unit === "カップ" || wasFraction) return formatQuarterQuantity(scaled, false);
  return String(Math.max(1, Math.ceil(scaled)));
}

function formatQuarterQuantity(value: number, roundUp = true) {
  const quarters = Math.max(1, roundUp ? Math.ceil(value * 4) : Math.round(value * 4));
  const whole = Math.floor(quarters / 4);
  const remainder = quarters % 4;
  if (remainder === 0) return String(whole);
  const fraction = remainder === 1 ? "1/4" : remainder === 2 ? "1/2" : "3/4";
  return whole === 0 ? fraction : `${whole}と${fraction}`;
}

function formatDecimal(value: number) {
  return Number(value.toFixed(1)).toString();
}
