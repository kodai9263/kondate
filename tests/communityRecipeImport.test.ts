import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync("supabase/migrations/202609120033_community_recipe_import.sql", "utf8");
const createActionSource = readFileSync("src/app/app/recipes/new/actions.ts", "utf8");
const recipesPageSource = readFileSync("src/app/app/recipes/page.tsx", "utf8");
const recipeActionSource = readFileSync("src/app/app/recipes/actions.ts", "utf8");
const plannerSource = readFileSync("src/lib/nutrition/server.ts", "utf8");

describe("みんなのメニュー", () => {
  it("公開登録RPCをservice roleだけに限定する", () => {
    expect(migrationSource).toContain("security definer");
    expect(migrationSource).toContain("set search_path = ''");
    expect(migrationSource).toContain("revoke all on function public.create_community_recipe");
    expect(migrationSource).toContain("to service_role");
    expect(migrationSource).not.toMatch(/create_community_recipe[\s\S]*to authenticated/);
  });

  it("Server Actionで認証・契約・公開者を再検証する", () => {
    expect(createActionSource).toContain("supabase.auth.getUser()");
    expect(createActionSource).toContain("isActiveSubscriptionStatus");
    expect(createActionSource).toContain("isRecipePublisher(user)");
    expect(createActionSource).toContain('getSupabaseAdmin().rpc("create_community_recipe"');
  });

  it("元URLを保存し、同じ公開URLの重複を防ぐ", () => {
    expect(migrationSource).toContain("recipes_community_source_url_idx");
    expect(migrationSource).toContain("'source_url', source_url");
    expect(createActionSource).toContain('error?.code === "23505"');
  });

  it("一覧と献立候補に表示し、家庭単位で非表示にできる", () => {
    expect(recipesPageSource).toContain("みんなのメニュー");
    expect(recipesPageSource).toContain('{ visibility: "community" }');
    expect(plannerSource).toContain('meta.visibility !== "community"');
    expect(plannerSource).toContain("community_key");
    expect(recipeActionSource).toContain('recipeKind: z.literal("community")');
    expect(recipeActionSource).toContain('.from("household_recipe_exclusions").insert');
    expect(recipeActionSource).not.toMatch(/\.delete\(\)/);
  });
});
