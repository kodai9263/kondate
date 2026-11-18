import { describe, it, expect } from "vitest";
import { safeSourceUrl, recipeSource, sourceLink, sourcePermissionSchema, groupSources, sourceRequestList, type SourceInventoryItem } from "@/lib/recipes/sources";
const valid = { recipeId: "20000000-0000-4000-8000-000000000001", providerName: "YouTube", authorName: "作者", sourceUrl: "https://youtu.be/abc", videoStartSeconds: "120", status: "unreviewed", allowedScope: "", checkedOn: "", evidence: "" };
describe("提供元と承諾記録", () => {
  it("外部リンクに危険なスキームや認証情報を含めない", () => {
    for (const input of ["javascript:alert(1)", "data:text/html,test", "https://user:pass@example.com", "//example.com", "invalid"]) expect(safeSourceUrl(input)).toBeNull();
    expect(safeSourceUrl("https://example.com/recipe")).toBe("https://example.com/recipe");
  });
  it("既存URLを引き継ぎ、作者や承諾を推測しない", () => {
    const source = recipeSource("recipe", { source_url: "https://youtu.be/abc" });
    expect(source.provider_name).toBe("YouTube"); expect(source.author_name).toBe("");
    expect(recipeSource("recipe", null).source_url).toBe("");
    expect(sourceLink({ ...source, video_start_seconds: 120 })).toBe("https://youtu.be/abc?t=120s");
  });
  it("承諾済みは確認日・掲載範囲・記録を必須とし、不正な日付や動画位置を拒否する", () => {
    expect(sourcePermissionSchema.safeParse(valid).success).toBe(true);
    expect(sourcePermissionSchema.safeParse({ ...valid, status: "approved" }).success).toBe(false);
    expect(sourcePermissionSchema.safeParse({ ...valid, status: "approved", checkedOn: "2026-11-17", allowedScope: "材料のみ", evidence: "返信を確認" }).success).toBe(true);
    for (const changed of [{ checkedOn: "2026-02-30" }, { sourceUrl: "https://youtube.com.evil.test/" }, { videoStartSeconds: "-1" }, { videoStartSeconds: "1.2" }, { status: "unknown" }]) {
      expect(sourcePermissionSchema.safeParse({ ...valid, ...changed }).success).toBe(false);
    }
    expect(sourcePermissionSchema.parse({ ...valid, videoStartSeconds: "" }).videoStartSeconds).toBeNull();
  });
  it("同じサイトでも作者別にまとめ、依頼用一覧に非公開記録を混ぜない", () => {
    const item: SourceInventoryItem = { id: "one", name: "親子丼", household_id: null, archived_at: null, held: true,
      source: { recipe_id: "one", provider_name: "YouTube", author_name: "A", source_url: "https://youtu.be/abc", video_start_seconds: null },
      permission: { recipe_id: "one", status: "requested", allowed_scope: "非公開メモ", checked_on: null, evidence: "非公開メール" } };
    const items = [item, { ...item, id: "two", source: { ...item.source, author_name: "B" } }];
    expect(groupSources(items)).toHaveLength(2);
    expect(sourceRequestList(items)).toContain("親子丼");
    expect(sourceRequestList(items)).not.toContain("非公開");
  });
});
