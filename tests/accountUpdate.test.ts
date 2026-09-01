import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync("src/app/account/actions.ts", "utf8");
const migrationSource = readFileSync("supabase/migrations/202609010022_atomic_account_update.sql", "utf8");

describe("アカウント設定の一括更新", () => {
  it("画面からは1つのRPCだけで設定を保存する", () => {
    const updateAccountSource = actionSource.slice(
      actionSource.indexOf("export async function updateAccount"),
      actionSource.indexOf("export async function createFamilyInvite"),
    );

    expect(updateAccountSource).toContain('supabase.rpc("update_current_household_account"');
    expect(updateAccountSource).not.toContain("Promise.all");
    expect(updateAccountSource).not.toContain('.from("profiles").update');
    expect(updateAccountSource).not.toContain('.from("households").update');
    expect(updateAccountSource).not.toContain('.from("household_settings").update');
  });

  it("RPCは認証ユーザーの家族だけをトランザクション内で更新する", () => {
    expect(migrationSource).toContain("security definer");
    expect(migrationSource).toContain("set search_path = ''");
    expect(migrationSource).toContain("target_user_id uuid := (select auth.uid())");
    expect(migrationSource).toContain("where profile.id = target_user_id");
    expect(migrationSource).toContain("on conflict (household_id) do update set");
    expect(migrationSource).toContain("revoke all on function");
    expect(migrationSource).toContain("grant execute on function");
  });
});
