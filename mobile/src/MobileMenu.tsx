import { useEffect, useRef, useState } from "react";
import { loadMenu, type MenuItem, type MenuResponse } from "./menu";

export function Menu({ accessToken, online }: { accessToken: string; online: boolean }) {
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "custom">("all");
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: MenuResponse; error?: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedId = selected?.id; const selectedKind = selected?.kind;
  const key = JSON.stringify([accessToken, selectedId, selectedKind, online, epoch]);
  const data = online && result?.key === key ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  const loading = online && result?.key !== key;
  useEffect(() => {
    const abort = new AbortController();
    if (online) void loadMenu(accessToken, selected, abort.signal).then((value) => {
      if (!abort.signal.aborted) setResult({ key, data: value });
    }).catch((cause: unknown) => {
      if (!abort.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : "メニューを読み込めませんでした。" });
    });
    return () => abort.abort();
  }, [accessToken, selected, key, online]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start" }); }, [selected]);
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase("ja");
  const items = data?.items?.filter((item) => (filter !== "custom" || item.kind === "custom") && item.name.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized)) ?? [];
  const recipe = data?.recipe;
  return <section className="menu-page">
    {selected && <button type="button" className="secondary-button" onClick={() => setSelected(null)}>メニュー一覧に戻る</button>}
    <div className="page-heading"><span className="section-tag">メニュー</span><h1 ref={heading} tabIndex={-1}>{selected?.name ?? "料理を探す"}</h1><p>{selected ? "材料をそろえて、作り方を上から順に進められます。" : "Web版のメニューをアプリでも確認できます。"}</p></div>
    {!online && <p className="read-only-note" role="status">メニューを見るには通信が必要です。接続を戻してお試しください。</p>}
    {loading && <p role="status">メニューを読み込んでいます…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="secondary-button" type="button" disabled={!online || loading} onClick={() => setEpoch((value) => value + 1)}>最新のメニューを確認</button>
    {!selected && <><label className="menu-search">料理名で検索<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：鮭、カレー" /></label>
      <div className="menu-filters" aria-label="メニューの種類"><button className="secondary-button" type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>すべて</button><button className="secondary-button" type="button" aria-pressed={filter === "custom"} onClick={() => setFilter("custom")}>わが家</button></div>
      {data?.items && <><p className="read-only-note">完成まで40分以内の料理 · {items.length}品</p><div className="menu-list">{items.map((item) => <button className="menu-card" type="button" key={`${item.kind}:${item.id}`} onClick={() => setSelected(item)}><span><strong>{item.name}</strong><small>{item.kind === "custom" ? "わが家 · " : ""}約{item.minutes}分</small></span><span aria-hidden="true">›</span></button>)}</div>{!items.length && <p role="status">該当するメニューがありません。検索語や種類を変えてお試しください。</p>}</>}
    </>}
    {recipe && <><p className="read-only-note">{recipe.servings}人分{!recipe.customized ? ` · 約${recipe.minutes}分` : " · アレンジ済み"}</p>
      <section className="menu-detail"><h2>材料</h2>{recipe.ingredients.length ? <ul>{recipe.ingredients.map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>材料は登録されていません。</p>}</section>
      {recipe.morning.length > 0 && <section className="menu-detail"><h2>朝の仕込み</h2><ol>{recipe.morning.map((line, index) => <li key={index}>{line}</li>)}</ol></section>}
      <section className="menu-detail"><h2>作り方</h2>{recipe.steps.length ? <ol>{recipe.steps.map((line, index) => <li key={index}>{line}</li>)}</ol> : <p>作り方は登録されていません。</p>}</section>
      {recipe.notes.length > 0 && <section className="menu-detail"><h2>メモ</h2>{recipe.notes.map((line, index) => <p key={index}>{line}</p>)}</section>}
      {recipe.sourceUrl && /^https:\/\//i.test(recipe.sourceUrl) && <a className="secondary-button" href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">元レシピを見る</a>}
    </>}
  </section>;
}
