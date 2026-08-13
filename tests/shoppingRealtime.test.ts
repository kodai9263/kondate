import { describe, expect, it } from "vitest";
import { getShoppingBroadcastRecord } from "@/lib/realtime/shoppingItems";

const item = {
  id: "f35bb34e-0503-4a67-b25f-b532bfd84e81",
  category: "追加したもの",
  name: "牛乳",
  position: 2,
  checked: false,
  source: "manual",
};

describe("getShoppingBroadcastRecord", () => {
  it("追加通知のrecordを読み取る", () => {
    expect(getShoppingBroadcastRecord({ event: "INSERT", payload: { record: item } })).toEqual({
      ...item,
      eventType: "INSERT",
    });
  });

  it("削除通知のold_recordを読み取る", () => {
    expect(getShoppingBroadcastRecord({ event: "DELETE", payload: { old_record: item } })).toEqual({
      ...item,
      eventType: "DELETE",
    });
  });

  it("Postgres Changes形式のnewも読み取る", () => {
    expect(getShoppingBroadcastRecord({ payload: { eventType: "UPDATE", new: { ...item, checked: true } } })).toEqual({
      ...item,
      checked: true,
      eventType: "UPDATE",
    });
  });

  it("必要な項目がない通知は無視する", () => {
    expect(getShoppingBroadcastRecord({ event: "UPDATE", payload: { record: { name: "牛乳" } } })).toBeNull();
  });
});
