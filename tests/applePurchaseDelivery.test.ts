import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({}), Capacitor: { getPlatform: () => "ios" } }));
import { deliverPurchase } from "../mobile/src/purchases";
const transaction = { id: "1234", signedTransaction: "signed-test" };
afterEach(() => vi.unstubAllGlobals());
describe("購入の保存と完了の順序", () => {
  it("確認APIの保存成功後だけApple側を完了する", async () => {
    const order: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => { order.push("saved"); return Response.json({ saved: true, transactionId: "1234", active: true }); }));
    const finish = vi.fn(async () => { order.push("finished"); });
    expect(await deliverPurchase("token", transaction, () => true, { finish })).toBe(true);
    expect(order).toEqual(["saved", "finished"]);
  });
  it.each([503, 409, 422])("保存失敗(%s)の取引を完了せず再送可能にする", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "billing_unavailable" }, { status })));
    const finish = vi.fn();
    await expect(deliverPurchase("token", transaction, () => true, { finish })).rejects.toThrow();
    expect(finish).not.toHaveBeenCalled();
  });
  it("別の取引の成功応答を採用しない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ saved: true, transactionId: "other", active: true })));
    const finish = vi.fn();
    await expect(deliverPurchase("token", transaction, () => true, { finish })).rejects.toThrow();
    expect(finish).not.toHaveBeenCalled();
  });
  it("アカウントが変わったら送信しない", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(deliverPurchase("token", transaction, () => false, { finish: vi.fn() })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
