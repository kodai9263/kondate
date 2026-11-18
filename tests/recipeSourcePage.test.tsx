import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceInventoryItem } from "@/lib/recipes/sources";
const fixtures = vi.hoisted(() => ({ items: [] as SourceInventoryItem[] }));
vi.mock("@/lib/recipes/sourcePermissions.server", () => ({ loadSourceInventory: async () => fixtures.items }));
vi.mock("@/app/admin/recipe-sources/actions", () => ({ saveSourcePermission: async () => ({ ok: true, message: "保存しました。" }) }));
import RecipeSourcesPage from "@/app/admin/recipe-sources/page";
const item = (id: string, name: string, author: string): SourceInventoryItem => ({ id, name, household_id: "household", archived_at: null, held: false,
  source: { recipe_id: id, provider_name: "YouTube", author_name: author, source_url: "https://youtu.be/example", video_start_seconds: 90 },
  permission: { recipe_id: id, status: "requested", checked_on: "2026-11-17", allowed_scope: "材料と手順の掲載について確認中", evidence: "メールで利用範囲を問い合わせ。返答待ち。" },
});
describe("提供元・承諾管理画面", () => {
  it("提供元別の一覧、保留表示、承諾編集、依頼用コピーを表示する", async () => {
    fixtures.items = [item("one", "鶏肉と野菜の煮込み", "おうち料理チャンネル"), { ...item("two", "だし香る親子丼", "おうち料理チャンネル"), held: true },
      { ...item("three", "季節の野菜スープ", ""), source: { recipe_id: "three", provider_name: "レシピサイト", author_name: "料理家さん", source_url: "https://example.com/recipes/soup", video_start_seconds: null }, permission: null }];
    const html = renderToStaticMarkup(await RecipeSourcesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("あなた専用"); expect(html).toContain("本文の表示保留中");
    expect(html).toContain("依頼用のメニュー一覧をコピー"); expect(html).toContain("承諾・依頼の記録");
    expect(html).toContain("動画の開始位置"); expect(html).toContain("3品中 3品");
    // 任意のローカル表示確認用。実データは使わない。
    if (process.env.RECIPE_SOURCE_PREVIEW_DIR) {
      mkdirSync(process.env.RECIPE_SOURCE_PREVIEW_DIR, { recursive: true });
      writeFileSync(join(process.env.RECIPE_SOURCE_PREVIEW_DIR, "index.html"), `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>${html}</body></html>`);
    }
  });
  it("検索語と承諾状況を組み合わせて絞り込む", async () => {
    fixtures.items = [item("one", "親子丼", "作者A"), { ...item("two", "カレー", "作者B"), permission: null }];
    const html = renderToStaticMarkup(await RecipeSourcesPage({ searchParams: Promise.resolve({ status: "unreviewed", q: "作者B" }) }));
    expect(html).toContain("カレー"); expect(html).not.toContain("親子丼"); expect(html).toContain("2品中 1品");
  });
});
