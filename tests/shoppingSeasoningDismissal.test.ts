import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync("supabase/migrations/202609040025_dismiss_weekly_seasonings.sql", "utf8");
const actionSource = readFileSync("src/app/app/shopping/actions.ts", "utf8");
const listSource = readFileSync("src/components/features/shopping/ShoppingList.tsx", "utf8");

describe("買い物リストの調味料削除", () => {
  it("既存品目を物理削除せずその週だけ非表示にする", () => {
    expect(migrationSource).toContain("add column if not exists dismissed boolean not null default false");
    expect(migrationSource).toContain("target_week_start");
    expect(migrationSource).toContain("dismissed = true");
    expect(migrationSource).not.toMatch(/delete\s+from/i);
  });

  it("調味料カテゴリと現在週の自動品目だけを受け付ける", () => {
    expect(actionSource).toContain("z.literal(seasoningShoppingCategory)");
    expect(actionSource).toContain("currentCycle.weekIndex !== weekIndex");
    expect(actionSource).toContain("currentCycle.weekStart !== weekStart");
    expect(actionSource).toContain("expectedName !== name");
  });

  it("調味料にだけ削除操作を表示して家族の更新を同期する", () => {
    expect(listSource).toContain("group.category === seasoningShoppingCategory ? dismissSeasoning : undefined");
    expect(listSource).toContain("row.dismissed");
    expect(listSource).toContain("買い物リストから削除");
  });
});
