export function getSafeAuthRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}
