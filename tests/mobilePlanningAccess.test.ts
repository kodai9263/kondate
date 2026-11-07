/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadToday } from "../mobile/src/today";
import { loadPlanner } from "../mobile/src/planner";

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ["今日", () => loadToday("test-token")],
  ["献立", () => loadPlanner("test-token", "week", "")],
] as const)("%sの利用案内", (_name, load) => {
  it("初回設定の未完了をアクセス拒否や期間終了と混同しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "planner_setup_required" }, { status: 403 })));
    const result = load();
    await expect(result).rejects.toThrow("最初に人数・アレルギー・献立の開始日を確認してください");
    await expect(result).rejects.toThrow("人数・アレルギー・献立の開始日");
  });

  it("利用期間の終了はアプリ内の家族プランと購入復元へ案内する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "free_trial_expired" }, { status: 403 })));
    await expect(load()).rejects.toThrow("「設定」の家族プラン");
  });

  it("家族共有の契約が必要な場合は契約者への確認を案内する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "family_access_required" }, { status: 403 })));
    await expect(load()).rejects.toThrow("家族の契約者に利用状態を確認してください");
  });

  it.each(["null", "[]", "not json", '{"error":"unknown"}'])("403の応答が%sでも原因を決めつけない", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 403 })));
    await expect(load()).rejects.toThrow("「設定」で利用状態を確認してください");
  });

  it("ログイン期限切れを初期設定の案内にしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "planner_setup_required" }, { status: 401 })));
    await expect(load()).rejects.toThrow("ログインの有効期限が切れました");
  });

  it("サーバー障害を初期設定の案内にしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "planner_setup_required" }, { status: 503 })));
    await expect(load()).rejects.toThrow(/読み込/);
  });
});
