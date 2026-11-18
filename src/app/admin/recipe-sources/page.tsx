import Link from "next/link";
import { loadSourceInventory } from "@/lib/recipes/sourcePermissions.server";
import { groupSources, permissionStatuses, sourceLink, sourceRequestList } from "@/lib/recipes/sources";
import { CopySourceList, SourcePermissionForm } from "@/components/features/recipe-sources/SourcePermissionForm";

export const dynamic = "force-dynamic";
export default async function RecipeSourcesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const [items, query] = await Promise.all([loadSourceInventory(), searchParams]);
  const term = (query.q ?? "").trim().toLocaleLowerCase("ja");
  const filtered = items.filter(item => (!query.status || (item.permission?.status ?? "unreviewed") === query.status) &&
    (!term || [item.name, item.source.provider_name, item.source.author_name, item.source.source_url].join(" ").toLocaleLowerCase("ja").includes(term)));
  return <main className="mx-auto min-h-dvh max-w-5xl px-4 py-8 sm:px-6">
    <Link href="/app/recipes" className="inline-flex min-h-11 items-center text-sm underline">メニューへ戻る</Link>
    <header className="mt-3 border-b border-kondate-line pb-5"><p className="text-xs font-semibold text-kondate-muted">あなた専用</p><h1 className="mt-2 font-mincho text-2xl font-bold">提供元・承諾管理</h1><p className="mt-3 text-sm leading-7">提供元ごとに料理と元URLを確認し、承諾のやり取りを記録できます。対象はアプリ提供メニューとあなたの家庭のメニューです。</p><p className="mt-2 text-sm text-kondate-muted">承諾状況と記録は一般ユーザーに表示されません。提供元・作者名・元URLは、閲覧可能なメニューに表示されます。</p></header>
    <form className="my-6 flex flex-wrap items-end gap-3"><label className="flex-1 text-sm">料理・提供元・作者名<input name="q" defaultValue={query.q} className="mt-1 min-h-11 w-full rounded border border-kondate-line px-3" /></label><label className="text-sm">承諾状況<select name="status" defaultValue={query.status ?? ""} className="mt-1 block min-h-11 rounded border border-kondate-line px-3"><option value="">すべて</option>{Object.entries(permissionStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="min-h-11 rounded bg-kondate-ink px-5 text-sm text-white">絞り込む</button></form>
    <p className="text-sm text-kondate-muted">{items.length}品中 {filtered.length}品</p>
    {groupSources(filtered).map(group => <section key={JSON.stringify([group.provider, group.author])} className="mt-6 rounded border border-kondate-line p-4 sm:p-5">
      <h2 className="break-words text-lg font-bold">{group.provider}{group.author ? ` ／ ${group.author}` : ""}</h2><p className="my-2 text-sm text-kondate-muted">{group.items.length}品</p><CopySourceList text={sourceRequestList(group.items)} />
      <div className="mt-4 divide-y divide-kondate-line">{group.items.map(item => <article key={item.id} className="py-4">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><span className="rounded bg-kondate-bg px-2 py-1 text-xs">{permissionStatuses[item.permission?.status ?? "unreviewed"]}</span>{item.held ? <span className="text-xs text-kondate-muted">本文の表示保留中</span> : null}{item.archived_at ? <span className="text-xs text-kondate-muted">削除済み</span> : null}<span className="text-xs text-kondate-muted">{item.household_id ? "わが家" : "アプリ提供"}</span></div>
        {sourceLink(item.source) ? <a href={sourceLink(item.source)!} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm underline">{item.source.source_url}{item.source.video_start_seconds !== null ? `（${item.source.video_start_seconds}秒から）` : ""}</a> : <p className="mt-2 text-sm text-kondate-muted">元URL未登録</p>}
        <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">提供元・承諾記録を編集</summary><SourcePermissionForm item={item} /></details>
      </article>)}</div>
    </section>)}
    {!filtered.length ? <p className="py-10 text-center text-sm">該当するメニューはありません。</p> : null}
  </main>;
}
