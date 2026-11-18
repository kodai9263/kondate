import { sourceLink, type RecipeSource } from "@/lib/recipes/sources";
export function RecipeSourceLink({ source }: { source: RecipeSource }) {
  const href = sourceLink(source);
  if (!href) return null;
  return <p className="text-xs leading-6 text-kondate-muted">提供元：<a href={href} target="_blank" rel="noopener noreferrer" className="break-words underline">{source.provider_name}{source.author_name ? ` ／ ${source.author_name}` : ""}{source.video_start_seconds !== null ? `（動画 ${source.video_start_seconds}秒から）` : ""}</a></p>;
}
