import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/mobile/request",async original=>({...await original<typeof import("@/lib/mobile/request")>(),authorizeMobileRequest:mocks.auth}));
import {GET,POST,DELETE,OPTIONS} from "@/app/api/mobile/v1/recipes/editor/route";
const id="20000000-0000-4000-8000-000000000031";
const fields={name:"カレー",side:"サラダ",cookMinutes:30,servings:4,proteinSource:"meat",ingredients:"玉ねぎ 1個",morning:"",steps:"煮る",energyKcal:500,proteinG:20,fatG:15,carbsG:60,fiberG:4,saltG:2,vegetablesG:120};
const payload={id,requestId:"30000000-0000-4000-8000-000000000031",revision:null,fields};
function request(body:unknown=payload){return new Request('https://app.test/api/mobile/v1/recipes/editor',{method:'POST',headers:{Origin:'capacitor://localhost'},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({supabase:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:id,error:null});});
describe('メニュー登録・編集API',()=>{
 it('入力を検証してトランザクション関数へ渡す',async()=>{expect((await POST(request())).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('save_household_recipe_editor',{target_id:id,request_id:payload.requestId,expected_revision:null,fields});expect(mocks.revalidate).toHaveBeenCalledWith('/app/recipes','layout');});
 it('未認証の登録を拒否',async()=>{mocks.auth.mockResolvedValue(new Response(null,{status:401}));expect((await POST(request())).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('空の料理名や不正な人数、余分な公開設定を拒否',async()=>{for(const body of [{...payload,fields:{...fields,name:''}},{...payload,fields:{...fields,servings:0}},{...payload,visibility:'community'}])expect((await POST(request(body))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('古い版での編集を409として返す',async()=>{mocks.rpc.mockResolvedValue({error:{message:'recipe_changed'}});expect((await POST(request())).status).toBe(409);expect(mocks.revalidate).not.toHaveBeenCalled();});
 it('失敗を成功にしない',async()=>{mocks.rpc.mockResolvedValue({error:{message:'database unavailable'}});expect((await POST(request())).status).toBe(503);});
 it('編集対象の不正IDを拒否',async()=>{expect((await GET(new Request('https://app.test/api/mobile/v1/recipes/editor?id=invalid'))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('不許可originを拒否',()=>{expect(OPTIONS(new Request('https://app.test',{headers:{Origin:'https://other.test'}})).status).toBe(403);});
});

it('栄養入力なしの登録を0で補完せず渡す',async()=>{const basic={name:'料理',side:'',cookMinutes:20,servings:2,proteinSource:'meat',ingredients:'玉ねぎ 1個',morning:'',steps:'炒める'};expect((await POST(request({...payload,fields:basic}))).status).toBe(200);expect(mocks.rpc.mock.calls[0][1].fields).toEqual(basic);});

describe('メニュー削除API',()=>{
 it('認証なしを拒否',async()=>{mocks.auth.mockResolvedValue(new Response(null,{status:401}));expect((await DELETE(request({id}))).status).toBe(401);});
 it('不正IDを拒否',async()=>{expect((await DELETE(request({id:'invalid'}))).status).toBe(400);});
 it('家族IDと料理種別を指定して非表示にし、物理削除しない',async()=>{
  const q={update:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),neq:vi.fn().mockReturnThis(),or:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{id},error:null})};
  mocks.auth.mockResolvedValue({householdId:'household',supabase:{from:vi.fn(()=>q)}});
  expect((await DELETE(request({id}))).status).toBe(200);
  expect(q.eq).toHaveBeenCalledWith('household_id','household');expect(q.eq).toHaveBeenCalledWith('id',id);
  expect(q.update).toHaveBeenCalledWith({archived_at:expect.any(String)});expect(q.neq).toHaveBeenCalledWith('category','breakfast');
  q.maybeSingle.mockResolvedValue({data:null,error:null});expect((await DELETE(request({id}))).status).toBe(404);
  q.maybeSingle.mockResolvedValue({data:null,error:{message:'failed'}});expect((await DELETE(request({id}))).status).toBe(503);
 });
});
