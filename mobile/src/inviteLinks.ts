const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inviteTokenFromUrl(value: string, apiBase = "https://kondate-bay.vercel.app"): string | null {
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.hash) return null;
    let token: string | undefined;
    if (url.protocol === "kyounogohan:" && url.hostname === "invite" && !url.port) {
      token = url.pathname.match(/^\/([^/]+)\/?$/)?.[1];
    } else if (url.protocol === "https:" && url.origin === new URL(apiBase).origin) {
      token = url.pathname.match(/^\/invite\/([^/]+)\/?$/)?.[1];
    }
    return token && tokenPattern.test(token) ? token.toLowerCase() : null;
  } catch { return null; }
}
