import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeMobileRequest, mobileJsonError, mobileOrigin, mobileNoStore, mobileResponseHeaders } from "@/lib/mobile/request";
import { recipeEditorRequest } from "@/lib/recipes/editorSchema";
export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  return new Response(null,{status:origin ? 204:403,headers:origin ? {...mobileResponseHeaders(origin),"Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS"}:mobileNoStore});
}
function failure(message: string, origin: string | null) {
  if (message.includes("family_access_required")) return mobileJsonError("family_access_required",403,origin);
  if (message.includes("recipe_changed")) return mobileJsonError("recipe_changed",409,origin);
  if (message.includes("recipe_not_found")) return mobileJsonError("recipe_not_found",404,origin);
  if (message.includes("invalid_recipe")) return mobileJsonError("invalid_recipe",400,origin);
  return mobileJsonError("recipe_save_unavailable",503,origin);
}
export async function GET(request: Request) {
  const origin=mobileOrigin(request); if(origin===false) return mobileJsonError("origin_not_allowed",403,null);
  try {
    const auth=await authorizeMobileRequest(request,origin); if(auth instanceof Response) return auth;
    const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
    if(!id.success) return mobileJsonError("invalid_recipe",400,origin);
    const result=await auth.supabase.rpc("household_recipe_editor",{target_id:id.data});
    if(result.error) return failure(result.error.message,origin);
    return Response.json({version:1,...result.data as object},{headers:mobileResponseHeaders(origin)});
  } catch { return mobileJsonError("recipe_save_unavailable",503,origin); }
}
export async function POST(request: Request) {
  const origin=mobileOrigin(request); if(origin===false) return mobileJsonError("origin_not_allowed",403,null);
  try {
    const auth=await authorizeMobileRequest(request,origin); if(auth instanceof Response) return auth;
    const parsed=recipeEditorRequest.safeParse(await request.json().catch(()=>null));
    if(!parsed.success) return mobileJsonError("invalid_recipe",400,origin);
    const value=parsed.data;
    const result=await auth.supabase.rpc("save_household_recipe_editor",{target_id:value.id,request_id:value.requestId,expected_revision:value.revision,fields:value.fields});
    if(result.error) return failure(result.error.message,origin);
    for(const path of ["/app","/app/recipes","/app/planner","/app/shopping"]) revalidatePath(path,"layout");
    return Response.json({version:1,id:result.data},{headers:mobileResponseHeaders(origin)});
  } catch { return mobileJsonError("recipe_save_unavailable",503,origin); }
}

export async function DELETE(request: Request) {
  const origin=mobileOrigin(request); if(origin===false) return mobileJsonError("origin_not_allowed",403,null);
  try {
    const auth=await authorizeMobileRequest(request,origin); if(auth instanceof Response) return auth;
    const parsed=z.object({id:z.string().uuid()}).strict().safeParse(await request.json().catch(()=>null));
    if(!parsed.success) return mobileJsonError("invalid_recipe",400,origin);
    // 自分の家族の料理だけを非表示にする。材料や保存済み献立は削除しない。
    const result=await auth.supabase.from("recipes").update({archived_at:new Date().toISOString()})
      .eq("id",parsed.data.id).eq("household_id",auth.householdId).neq("category","breakfast")
      .or("meta->>step_customization.is.null,meta->>step_customization.neq.true").select("id").maybeSingle();
    if(result.error) return mobileJsonError("recipe_delete_unavailable",503,origin);
    if(!result.data) return mobileJsonError("recipe_not_found",404,origin);
    for(const path of ["/app","/app/recipes","/app/planner","/app/shopping"]) revalidatePath(path,"layout");
    return Response.json({version:1,id:result.data.id},{headers:mobileResponseHeaders(origin)});
  } catch { return mobileJsonError("recipe_delete_unavailable",503,origin); }
}
