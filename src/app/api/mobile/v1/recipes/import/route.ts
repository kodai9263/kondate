import { z } from "zod";
import { authorizeMobileRequest, mobileJsonError, mobileOrigin, mobileNoStore, mobileResponseHeaders } from "@/lib/mobile/request";
import { fetchPrivateRecipe, privateRecipeUrl, privateImportMessage } from "@/lib/recipes/privateImport";
export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  return new Response(null, { status: origin ? 204 : 403, headers: origin ? { ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "POST, OPTIONS" } : mobileNoStore });
}
export async function POST(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const auth = await authorizeMobileRequest(request, origin);
    if (auth instanceof Response) return auth;
    const body = z.object({ url: z.string().trim().max(2048) }).strict().safeParse(await request.json().catch(() => null));
    if (!body.success) return mobileJsonError("invalid_url", 400, origin);
    privateRecipeUrl(body.data.url);
    const reserve = await auth.supabase.rpc("reserve_household_recipe_import");
    if (reserve.error) return mobileJsonError("import_unavailable", 503, origin);
    if (reserve.data !== true) return mobileJsonError("import_rate_limited", 429, origin);
    return Response.json({ version: 1, recipe: await fetchPrivateRecipe(body.data.url) }, { headers: mobileResponseHeaders(origin) });
  } catch (error) {
    return Response.json({ error: "import_failed", message: privateImportMessage(error) }, { status: 400, headers: mobileResponseHeaders(origin) });
  }
}
