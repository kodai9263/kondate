import { describe, expect, it } from "vitest";
import { addPlanIngredients, daysFrom, emptyGuestState, guestCatalog, guestStorageKey, localDay,
  readGuestState, saveGuestRecipe, writeGuestState, type GuestRecipe } from "../mobile/src/guestStore";

function storage() {
  const values = new Map<string, string>([["authenticated-household", "private-account-data"]]);
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const own: GuestRecipe = { id: "local-recipe", name: "自分の料理", custom: true, minutes: 20, servings: 2, ingredients: ["豆腐 1丁", "水 100ml"], steps: ["加熱する"] };
describe("登録なしの端末内データ", () => {
  it("初回は個人情報不要で空の予定と買い物、閲覧できる料理を用意する", () => {
    expect(readGuestState(storage())).toEqual(emptyGuestState());
    expect(guestCatalog.length).toBeGreaterThan(10);
    expect(guestCatalog.every(recipe => recipe.ingredients.length && recipe.steps.length && !recipe.custom)).toBe(true);
  });
  it("料理の編集・献立・買い物チェックを再起動後も保持し、家族データは触らない", () => {
    const port = storage();
    let state = saveGuestRecipe(emptyGuestState(), own);
    state = { ...state, plans: { "2026-11-18": own } };
    state = saveGuestRecipe(state, { ...own, name: "編集した料理" });
    state = addPlanIngredients(state, "2026-11-18");
    state.shopping[0].checked = true;
    writeGuestState(port, state);
    expect(readGuestState(port)).toEqual(state);
    expect(readGuestState(port).plans["2026-11-18"]?.name).toBe("編集した料理");
    expect(port.values.get("authenticated-household")).toBe("private-account-data");
    expect([...port.values.keys()]).toEqual(["authenticated-household", guestStorageKey]);
  });
  it("同じ日の材料を二重追加せず、変更済みの料理の材料へ置換する", () => {
    let state = { ...emptyGuestState(), plans: { "2026-11-18": own } };
    state = addPlanIngredients(state, "2026-11-18") as typeof state;
    state.shopping[0].checked = true;
    state = addPlanIngredients(state, "2026-11-18") as typeof state;
    expect(state.shopping).toHaveLength(2);
    expect(state.shopping[0].checked).toBe(true);
    state.plans["2026-11-18"] = { ...own, ingredients: ["卵 2個"] };
    expect(addPlanIngredients(state, "2026-11-18").shopping.map(item => item.name)).toEqual(["卵 2個"]);
  });
  it("別の日の材料と手入力を残し、作らない日は追加しない", () => {
    const state = addPlanIngredients({ ...emptyGuestState(), plans: { "2026-11-18": own, "2026-11-19": null }, shopping: [{ id: "manual", name: "牛乳", checked: false }] }, "2026-11-18");
    expect(addPlanIngredients(state, "2026-11-19")).toEqual(state);
    expect(state.shopping[0].name).toBe("牛乳");
  });
  it("保存済み献立は一覧から料理を削除しても残る", () => {
    const state = { ...emptyGuestState(), recipes: [], plans: { "2026-11-18": own } };
    const port = storage(); writeGuestState(port, state);
    expect(readGuestState(port).plans["2026-11-18"]).toEqual(own);
  });
  it("破損データを初期化して上書きしない", () => {
    const port = storage(); port.setItem(guestStorageKey, '{"version":2}');
    expect(() => readGuestState(port)).toThrow();
    expect(port.getItem(guestStorageKey)).toBe('{"version":2}');
    port.setItem(guestStorageKey, "broken"); expect(() => readGuestState(port)).toThrow();
  });
  it("保存失敗は呼び出し元へ返し、保存成功と扱わない", () => {
    expect(() => writeGuestState({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, emptyGuestState())).toThrow("quota");
  });
  it("月末・年末をまたぐ日付を端末の暦で扱う", () => {
    expect(daysFrom("2026-12-30", 4)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(localDay(new Date(2026, 10, 18, 0, 1))).toBe("2026-11-18");
  });
});
