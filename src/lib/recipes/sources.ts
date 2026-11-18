import { z } from "zod";

export const permissionStatuses = {
  unreviewed: "未確認", requested: "依頼中", approved: "承諾済み", denied: "掲載不可",
} as const;
export type RecipeSource = {
  recipe_id: string; provider_name: string; author_name: string; source_url: string;
  video_start_seconds: number | null;
};
export type RecipePermission = {
  recipe_id: string; status: keyof typeof permissionStatuses; allowed_scope: string;
  checked_on: string | null; evidence: string;
};

export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function isYoutubeUrl(value: string) {
  const safe = safeSourceUrl(value);
  if (!safe) return false;
  const host = new URL(safe).hostname.toLowerCase();
  return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(host);
}

export function recipeSource(recipeId: string, meta: unknown, saved?: RecipeSource | null): RecipeSource {
  const fields = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
  const text = (key: string) => typeof fields[key] === "string" ? fields[key] as string : "";
  const sourceUrl = safeSourceUrl(saved ? saved.source_url : text("source_url")) ?? "";
  return {
    recipe_id: recipeId,
    provider_name: saved?.provider_name || text("source_name") || (sourceUrl ? isYoutubeUrl(sourceUrl) ? "YouTube" : new URL(sourceUrl).hostname : "提供元未登録"),
    author_name: saved ? saved.author_name : text("author_name") || text("channel_name"),
    source_url: sourceUrl,
    video_start_seconds: saved?.video_start_seconds ?? null,
  };
}

export function sourceLink(source: RecipeSource) {
  const safe = safeSourceUrl(source.source_url);
  if (!safe) return null;
  const url = new URL(safe);
  if (isYoutubeUrl(safe) && source.video_start_seconds !== null) {
    url.searchParams.set("t", `${source.video_start_seconds}s`);
  }
  return url.href;
}

const optionalDate = z.string().refine(value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
export const sourcePermissionSchema = z.object({
  recipeId: z.string().uuid(),
  providerName: z.string().trim().max(160), authorName: z.string().trim().max(160),
  sourceUrl: z.string().trim().max(2000).refine(value => !value || Boolean(safeSourceUrl(value))),
  videoStartSeconds: z.preprocess(value => value === "" || value == null ? null : value, z.coerce.number().int().min(0).max(86400).nullable()),
  status: z.enum(["unreviewed", "requested", "approved", "denied"]),
  allowedScope: z.string().trim().max(4000), checkedOn: optionalDate, evidence: z.string().trim().max(8000),
}).refine(value => value.videoStartSeconds === null || isYoutubeUrl(value.sourceUrl), { message: "開始位置はYouTubeのURLと一緒に入力してください。" })
  .refine(value => value.status !== "approved" || Boolean(value.allowedScope && value.checkedOn && value.evidence), { message: "承諾済みには許可範囲・確認日・承諾記録が必要です。" });

export type SourceInventoryItem = {
  id: string; name: string; household_id: string | null; archived_at: string | null;
  source: RecipeSource; permission: RecipePermission | null; held: boolean;
};
export function groupSources(items: SourceInventoryItem[]) {
  const groups = new Map<string, { provider: string; author: string; items: SourceInventoryItem[] }>();
  for (const item of items) {
    const key = JSON.stringify([item.source.provider_name, item.source.author_name]);
    const group = groups.get(key) ?? { provider: item.source.provider_name, author: item.source.author_name, items: [] };
    group.items.push(item); groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.provider.localeCompare(b.provider, "ja") || a.author.localeCompare(b.author, "ja"));
}
export function sourceRequestList(items: SourceInventoryItem[]) {
  return items.map(item => `・${item.name}\n  ${sourceLink(item.source) ?? "元URL未登録"}`).join("\n");
}
