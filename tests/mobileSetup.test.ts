import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/mobile/request", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/mobile/request")>(), authorizeMobileRequest: mock.auth }));
vi.mock("@/lib/billing/firstWeek.server", () => ({ getFirstWeekAccess: mock.access }));
vi.mock("@/lib/family/server", () => ({ getCurrentHouseholdPreferences: async () => ({ adultCount: 2, childCount: 1, allergies: ["卵"] }) }));
import { GET, POST } from "@/app/api/mobile/v1/setup/route";
const valid = { adults: 2, children: 1, start: "2026-11-08", allergies: ["卵", "卵"], confirmed: true };
const req = (value: unknown = valid, origin = "capacitor://localhost") => new Request("http://localhost/api/mobile/v1/setup", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(value) });
beforeEach(() => {
 vi.clearAllMocks(); mock.auth.mockResolvedValue({ supabase: { rpc: mock.rpc }, accessToken: "valid-token" });
 mock.access.mockResolvedValue({ canPlan: true, trial: { selected_start: "2026-11-08" } }); mock.rpc.mockResolvedValue({ error: null });
});
describe("アプリ内の初回設定", () => {
 it("家族の現設定を返す", async () => { expect(await (await GET(req())).json()).toMatchObject({ adults: 2, children: 1, allergies: ["卵"], start: "2026-11-08" }); });
 it("確認付きの入力を、同じ家族の原子的RPCへ保存する", async () => {
   expect((await POST(req())).status).toBe(200);
   expect(mock.rpc).toHaveBeenCalledWith("configure_first_week", { adults: 2, children: 1, start_input: "2026-11-08", allergens: ["卵"] });
 });
 it("確認なし・範囲外・余分な家族指定を保存しない", async () => {
   for (const input of [{ ...valid, confirmed: false }, { ...valid, adults: 0 }, { ...valid, start: "2026-02-30" }, { ...valid, householdId: "other" }]) expect((await POST(req(input))).status).toBe(400);
   expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("許可外のOriginと未ログインを拒否する", async () => {
   expect((await POST(req(valid, "https://evil.example"))).status).toBe(403); expect(mock.auth).not.toHaveBeenCalled();
   mock.auth.mockResolvedValue(new Response(null, { status: 401 })); expect((await POST(req())).status).toBe(401); expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("無料期間の終了を設定変更で回避できない", async () => {
   mock.access.mockResolvedValue({ canPlan: false }); expect((await POST(req())).status).toBe(403); expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("保存失敗を成功として返さない", async () => {
   mock.rpc.mockResolvedValue({ error: { message: "rejected" } }); expect((await POST(req())).status).toBe(503);
 });
});
