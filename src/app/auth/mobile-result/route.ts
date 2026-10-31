import { sameOriginRequest } from "@/lib/auth/requestOrigin";
import { createClient } from "@supabase/supabase-js";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sameOriginRequest(request)) return new Response(null, { status: 403, headers });
  const text = await request.text();
  if (text.length > 8192) return new Response(null, { status: 400, headers });
  let input: { accessToken?: unknown };
  try { input = JSON.parse(text); } catch { return new Response(null, { status: 400, headers }); }
  if (typeof input?.accessToken !== "string" || !/^[A-Za-z0-9._~-]{16,8192}$/.test(input.accessToken)) return new Response(null, { status: 400, headers });
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(input.accessToken);
    return Response.json({ confirmed: !error && !!data.user?.email_confirmed_at }, { status: !error && data.user?.email_confirmed_at ? 200 : 401, headers });
  } catch { return new Response(null, { status: 503, headers }); }
}
