import { useEffect, useRef, useState, type FormEvent } from "react";
import { TodaySteps } from "./ContentSections";
import { addPlanIngredients, daysFrom, emptyGuestState, guestCatalog, localDay, readGuestState,
  saveGuestRecipe, writeGuestState, type GuestRecipe, type GuestState } from "./guestStore";

type Tab = "today" | "planner" | "shopping" | "menu" | "settings";
export function GuestApp({ onLogin }: { onLogin: () => void }) {
  const [loaded, setLoaded] = useState(() => {
    try { return { data: readGuestState(localStorage), error: "" }; }
    catch { return { data: null, error: "端末の保存データを読み込めませんでした。データを上書きせずに停止しています。アプリを開き直してお試しください。" }; }
  });
  const [state, setState] = useState<GuestState>(() => loaded.data ?? emptyGuestState());
  const current = useRef(state);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [today, setToday] = useState(localDay);
  const [start, setStart] = useState(localDay);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<GuestRecipe | null>(null);
  const [editor, setEditor] = useState<{ recipe: GuestRecipe | null } | null>(null);
  const [query, setQuery] = useState("");
  const [newItem, setNewItem] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const refreshDay = () => setToday(localDay());
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
    const timer = window.setInterval(refreshDay, 60_000);
    return () => { clearInterval(timer); window.removeEventListener("focus", refreshDay); document.removeEventListener("visibilitychange", refreshDay); };
  }, []);
  useEffect(() => { heading.current?.scrollIntoView({ block: "start" }); }, [tab, selected, editor, chosenDay]);

  function commit(change: (previous: GuestState) => GuestState, message = "端末に保存しました。") {
    if (!loaded.data) return false;
    try {
      const next = change(current.current);
      // 保存に失敗した内容を、保存済みとして画面へ出さない。
      writeGuestState(localStorage, next);
      current.current = next; setState(next); setError(""); setNotice(message); return true;
    } catch { setNotice(""); setError("端末に保存できませんでした。空き容量や保存設定を確認して、もう一度お試しください。入力内容はまだ保存されていません。"); return false; }
  }
  function switchTab(next: Tab) {
    if (editor && !window.confirm("編集中の内容はまだ保存されていません。別の画面へ移りますか？")) return;
    setTab(next); setEditor(null); setSelected(null); setChosenDay(null); setNotice(""); setError("");
  }
  const recipes = [...state.recipes, ...guestCatalog];
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase("ja");
  const filtered = recipes.filter(recipe => recipe.name.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized));
  const dinner = state.plans[today];
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "https://kondate-bay.vercel.app";
  const title = editor ? editor.recipe ? "メニューを編集" : "メニューを登録" : chosenDay ? "主菜を選ぶ" : selected?.name ?? ({ today: "今日の献立", planner: "献立", shopping: "買い物リスト", menu: "料理を探す", settings: "設定" }[tab]);

  return <>
    <nav className="mobile-tabs" aria-label="主な画面">{([['today','今日'],['planner','献立'],['shopping','買い物'],['menu','メニュー'],['settings','設定']] as const).map(([key,label]) => <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => switchTab(key)}>{label}</button>)}</nav>
    <p className="read-only-note guest-mode-note">登録なしで利用中 · この端末に保存</p>
    <section className="guest-page">
      <div className="page-heading"><h1 ref={heading} tabIndex={-1}>{title}</h1></div>
      {loaded.error ? <section className="card" role="alert"><p>{loaded.error}</p><button type="button" className="secondary-button" onClick={() => {
        try { const data = readGuestState(localStorage); current.current = data; setState(data); setLoaded({ data, error: "" }); }
        catch { setError("まだ読み込めませんでした。元のデータは変更していません。"); }
      }}>読み込みを再試行</button><button type="button" className="secondary-button" onClick={onLogin}>ログイン画面を開く</button></section> : <>
        {editor ? <GuestEditor recipe={editor.recipe} onSave={recipe => {
          if (!commit(previous => saveGuestRecipe(previous, recipe))) return false;
          setEditor(null); setSelected(recipe); return true;
        }} onClose={() => setEditor(null)} /> : chosenDay ? <>
          <p>{chosenDay}の主菜を選んでください。</p><button type="button" className="secondary-button" onClick={() => setChosenDay(null)}>献立に戻る</button>
          <RecipeSearch query={query} setQuery={setQuery} />
          <div className="menu-list">{filtered.map(recipe => <button key={recipe.id} type="button" className="menu-card" onClick={() => {
            if (commit(previous => ({ ...previous, plans: { ...previous.plans, [chosenDay]: recipe } }))) setChosenDay(null);
          }}><span><strong>{recipe.name}</strong><small>{recipe.servings}人分 · 約{recipe.minutes}分</small></span><span aria-hidden="true">＋</span></button>)}</div>
          {!filtered.length && <p>該当する料理がありません。「メニュー」で自分の料理を登録できます。</p>}
        </> : selected ? <>
          <button type="button" className="secondary-button" onClick={() => setSelected(null)}>戻る</button>
          <RecipeDetails recipe={selected} />
          {selected.custom && <button type="button" className="secondary-button" onClick={() => setEditor({ recipe: selected })}>このメニューを編集</button>}
          <button type="button" className="primary-button" onClick={() => { setSelected(null); setTab("planner"); setNotice("料理を入れる日付の「主菜を選ぶ」を押してください。"); }}>献立を開く</button>
          {selected.custom && <button type="button" className="secondary-button" onClick={() => {
            if (!window.confirm(`「${selected.name}」をメニュー一覧から削除しますか？ 保存済みの献立は残ります。`)) return;
            if (commit(previous => ({ ...previous, recipes: previous.recipes.filter(recipe => recipe.id !== selected.id) }), "メニュー一覧から削除しました。保存済みの献立は残ります。")) setSelected(null);
          }}>このメニューを削除</button>}
        </> : tab === "today" ? <>
          <p>{today}</p>
          {dinner ? <section className="account-card"><h2>{dinner.name}</h2><RecipeDetails recipe={dinner} /><button type="button" className="primary-button" onClick={() => commit(previous => addPlanIngredients(previous, today), "今日の材料を買い物リストに追加しました。")}>材料を買い物に追加</button></section>
            : <section className="account-card"><p>{dinner === null ? "今日は作らない日です。" : "今日の献立を選びましょう。"}</p><button type="button" className="primary-button" onClick={() => { setTab("planner"); setChosenDay(today); setQuery(""); }}>主菜を選ぶ</button></section>}
          <button type="button" className="secondary-button" onClick={() => switchTab("menu")}>材料・作り方を見る</button>
        </> : tab === "planner" ? <>
          <label className="menu-search">開始日<input type="date" value={start} onChange={event => { if (event.target.value) setStart(event.target.value); }} /></label>
          <p className="hint">日付を変えて、先の予定も作れます。</p>
          {daysFrom(start, 7).map(day => <section className="account-card" key={day}><h2>{day}</h2><p>{state.plans[day]?.name ?? (state.plans[day] === null ? "作らない日" : "献立は未設定")}</p>
            <button className="secondary-button" type="button" onClick={() => { setChosenDay(day); setQuery(""); }}>{state.plans[day] ? "主菜を変更" : "主菜を選ぶ"}</button>
            {state.plans[day] && <><button className="secondary-button" type="button" onClick={() => setSelected(state.plans[day])}>材料・作り方</button><button className="secondary-button" type="button" onClick={() => commit(previous => addPlanIngredients(previous, day), `${day}の材料を買い物リストに追加しました。`)}>材料を買い物に追加</button></>}
            <button className="secondary-button" type="button" onClick={() => commit(previous => ({ ...previous, plans: { ...previous.plans, [day]: null } }))}>この日は作らない</button>
          </section>)}
        </> : tab === "shopping" ? <>
          <p>残り {state.shopping.filter(item => !item.checked).length}件</p>
          <p className="hint">献立の材料は「材料を買い物に追加」で取り込めます。分量は各料理に表示された人数分です。献立を変更した場合は、もう一度追加するとその日の材料を更新します。</p>
          <form onSubmit={event => { event.preventDefault(); if (!newItem.trim()) return; if (commit(previous => ({ ...previous, shopping: [...previous.shopping, { id: crypto.randomUUID(), name: newItem.trim(), checked: false }] }))) setNewItem(""); }}>
            <label>買うもの<input value={newItem} onChange={event => setNewItem(event.target.value)} maxLength={120} required /></label><button className="primary-button" type="submit">買い物に追加</button>
          </form>
          {!state.shopping.length && <p>買い物リストは空です。上の入力欄や献立から追加できます。</p>}
          {state.shopping.map(item => <div className="guest-shopping-row" key={item.id}><label><input type="checkbox" checked={item.checked} onChange={event => commit(previous => ({ ...previous, shopping: previous.shopping.map(row => row.id === item.id ? { ...row, checked: event.target.checked } : row) }))} /><span>{item.name}{item.source && <small>献立：{item.source}</small>}</span></label><button type="button" className="text-button" aria-label={`${item.name}を削除`} onClick={() => { if (window.confirm(`「${item.name}」を買い物リストから削除しますか？`)) commit(previous => ({ ...previous, shopping: previous.shopping.filter(row => row.id !== item.id) })); }}>削除</button></div>)}
        </> : tab === "menu" ? <>
          <button type="button" className="primary-button" onClick={() => setEditor({ recipe: null })}>メニューを登録</button>
          <RecipeSearch query={query} setQuery={setQuery} />
          <p>{filtered.length}品 · 通信なしでも材料・作り方を開けます。</p>
          <div className="menu-list">{filtered.map(recipe => <button key={recipe.id} type="button" className="menu-card" onClick={() => setSelected(recipe)}><span><strong>{recipe.name}</strong><small>{recipe.custom ? "自分の料理 · " : ""}{recipe.servings}人分 · 約{recipe.minutes}分</small></span><span aria-hidden="true">›</span></button>)}</div>
          {!filtered.length && <p>該当する料理がありません。</p>}
        </> : <>
          <section className="account-card"><h2>この端末で使う</h2><p>登録なしで料理・献立・買い物を利用できます。利用期限はありません。</p><p>データはこの端末だけに保存します。アプリを削除すると失われます。</p></section>
          <section className="account-card"><h2>家族と共有・ほかの端末と同期</h2><p>共有・同期にはアカウントが必要です。家族プランは月額480円・年額4,800円（日本）です。</p><p>端末内のデータとログイン後の家族データは別です。自動で移行・上書きしません。ログアウトすると端末内のデータを再び開けます。</p><button type="button" className="primary-button" onClick={onLogin}>ログイン・新規登録</button></section>
          <section className="account-card"><h2>サポート</h2><p><a href={`${apiBase}/support`} target="_blank" rel="noopener noreferrer">お問い合わせ・フィードバック</a></p><p><a href={`${apiBase}/terms`} target="_blank" rel="noopener noreferrer">利用規約</a> · <a href={`${apiBase}/privacy`} target="_blank" rel="noopener noreferrer">プライバシーポリシー</a></p></section>
        </>}
      </>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="notice-message" role="status">{notice}</p>}
    </section>
  </>;
}
function RecipeSearch({ query, setQuery }: { query: string; setQuery: (query: string) => void }) {
  return <label className="menu-search">料理名で検索<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例：鮭、カレー" /></label>;
}
function RecipeDetails({ recipe }: { recipe: GuestRecipe }) {
  return <><p>{recipe.servings}人分 · 約{recipe.minutes}分</p><TodaySteps title="材料・調味料" steps={recipe.ingredients} /><TodaySteps title="作り方" steps={recipe.steps} /></>;
}
function GuestEditor({ recipe, onSave, onClose }: { recipe: GuestRecipe | null; onSave: (recipe: GuestRecipe) => boolean; onClose: () => void }) {
  const [id] = useState(() => recipe?.id ?? crypto.randomUUID());
  const dirty = useRef(false);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const split = (key: string) => String(data.get(key) ?? "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const next: GuestRecipe = { id, custom: true, name: String(data.get("name") ?? "").trim(), minutes: Number(data.get("minutes")), servings: Number(data.get("servings")), ingredients: split("ingredients"), steps: split("steps") };
    if (!next.name || !next.ingredients.length || !next.steps.length) { setError("料理名・材料・作り方を入力してください。"); return; }
    onSave(next);
  }
  return <><button className="secondary-button" type="button" onClick={() => { if (!dirty.current || window.confirm("入力した内容を保存せずに戻りますか？")) onClose(); }}>一覧に戻る</button>
    <p>この端末だけに保存する料理です。材料は指定した人数分を入力してください。</p>
    <form className="menu-editor" onSubmit={submit} onChange={() => { dirty.current = true; }}><label>料理名<input name="name" required maxLength={80} defaultValue={recipe?.name ?? ""} /></label>
      <label>完成までの時間（分）<input name="minutes" type="number" required min={1} max={240} step={1} defaultValue={recipe?.minutes ?? 30} /></label>
      <label>何人分の材料ですか<input name="servings" type="number" required min={1} max={20} step={1} defaultValue={recipe?.servings ?? 4} /></label>
      <label>材料<textarea name="ingredients" required maxLength={4000} rows={5} defaultValue={recipe?.ingredients.join("\n") ?? ""} /><small>1行に1つずつ入力してください。</small></label>
      <label>作り方<textarea name="steps" required maxLength={4000} rows={7} defaultValue={recipe?.steps.join("\n") ?? ""} /></label>
      {error && <p role="alert" className="error-message">{error}</p>}<button className="primary-button" type="submit">メニューを保存</button>
    </form></>;
}
