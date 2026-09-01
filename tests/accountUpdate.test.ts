import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync("src/app/account/actions.ts", "utf8");
const accountPageSource = readFileSync("src/app/account/page.tsx", "utf8");
const scrollToAccountTopSource = readFileSync("src/components/features/account/ScrollToAccountTop.tsx", "utf8");
const migrationSource = readFileSync("supabase/migrations/202609010022_atomic_account_update.sql", "utf8");
const schemaRepairSource = readFileSync("supabase/migrations/202609010023_repair_household_settings_schema.sql", "utf8");

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

  it("保存成功後は完了メッセージが見える設定画面の先頭に戻る", () => {
    expect(actionSource).toContain("/account?success=updated&save=${Date.now()}#account-top");
    expect(accountPageSource).toContain('id="account-top"');
    expect(accountPageSource).toContain("<ScrollToAccountTop saveId={params.save} />");
    expect(scrollToAccountTopSource).toContain("window.requestAnimationFrame");
    expect(scrollToAccountTopSource).toContain("window.scrollTo({ top: 0");
  });

  it("Stripe契約のない手動PROに課金管理ボタンを表示しない", () => {
    expect(accountPageSource).toContain("stripe_customer_id");
    expect(accountPageSource).toContain("const hasStripeCustomer = Boolean(subscription?.stripe_customer_id)");
    expect(accountPageSource).toContain("運営者用PROのため、料金は発生していません。");
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

  it("本番DBに不足した家族設定列を既存データを保ったまま補修する", () => {
    expect(schemaRepairSource).toContain("add column if not exists adult_count");
    expect(schemaRepairSource).toContain("add column if not exists child_count");
    expect(schemaRepairSource).toContain("add column if not exists shopping_day");
    expect(schemaRepairSource).toContain("default 2");
    expect(schemaRepairSource).toContain("default 3");
    expect(schemaRepairSource).toContain("default 6");
    expect(schemaRepairSource).not.toMatch(/drop\s+column/i);
  });
});
