// Next.jsが内部URLをlocalhostへ正規化しても、ブラウザが開いたHostと照合する。
export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ["https:", "http:"].includes(url.protocol) && url.host === host;
  } catch { return false; }
}
