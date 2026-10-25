import { useEffect, useRef, useState } from "react";
import { changePlannerDay, loadPlanner, type PlannerChange, type PlannerDay, type PlannerSnapshot } from "./planner";

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date(`${date}T12:00:00+09:00`));
}
export function Planner({ accessToken, online, onSaved }: { accessToken: string; online: boolean; onSaved: () => void }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [date, setDate] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{ key: string; data: PlannerSnapshot | null; error: string } | null>(null);
  const requestKey = JSON.stringify([accessToken, view, date, epoch, online]);
  const data = result?.key === requestKey && online ? result.data : null;
  const loading = online && result?.key !== requestKey;
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const generation = useRef(0);
  const [saveError, setSaveError] = useState("");
  const error = saveError || (result?.key === requestKey ? result.error : "");
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState<{ day: PlannerDay; kind: "recipe" | "side" } | null>(null);
  const [query, setQuery] = useState("");
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const busy = loading || saving || !online;
  const selectedDay = data?.days.find((day) => day.date === detailDate) ?? data?.days.find((day) => day.date === data.today) ?? data?.days[0];
  const visibleDays = view === "month" ? selectedDay ? [selectedDay] : [] : data?.days ?? [];
  const leading = data?.days[0] ? (new Date(`${data.days[0].date}T12:00:00+09:00`).getUTCDay() + 6) % 7 : 0;

  useEffect(() => {
    const current = ++generation.current;
    const abort = new AbortController();
    if (online) void loadPlanner(accessToken, view, date, abort.signal).then((value) => {
      if (!abort.signal.aborted) setResult({ key: requestKey, data: value, error: "" });
    }).catch((cause: unknown) => {
      if (!abort.signal.aborted) setResult({ key: requestKey, data: null, error: cause instanceof Error ? cause.message : "献立を読み込めませんでした。" });
    });
    return () => { generation.current = current + 1; abort.abort(); };
  }, [accessToken, view, date, requestKey, online]);

  useEffect(() => {
    if (picker && data && !dialogRef.current?.open) dialogRef.current?.showModal();
    if ((!picker || !data) && dialogRef.current?.open) dialogRef.current.close();
  }, [picker, data]);

  useEffect(() => {
    if (view === "month" && detailDate) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [view, detailDate]);

  async function save(day: PlannerDay, change: PlannerChange) {
    if (busy || savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError(""); setMessage("");
    const current = generation.current;
    try {
      await changePlannerDay(accessToken, day, change);
      if (generation.current !== current) return;
      onSaved(); setPicker(null);
      setMessage("保存しました。今日の献立と買い物リストにも反映されます。");
      setEpoch((value) => value + 1);
    } catch (cause) {
      if (generation.current !== current) return;
      setPicker(null); setResult({ key: requestKey, data: null, error: "" });
      setSaveError(cause instanceof Error ? cause.message : "保存結果を確認できません。最新の献立を確認してください。");
    } finally { savingRef.current = false; setSaving(false); }
  }
  function navigate(nextDate: string, nextView = view) {
    if (busy) return;
    setMessage(""); setSaveError(""); setPicker(null); setDetailDate(null); setDate(nextDate); setView(nextView);
  }
  return <section className="planner-page" aria-busy={loading || saving}>
    <header className="page-heading"><span className="section-tag">献立を調整</span><h1>家族の献立</h1><p>Web版と同じ献立です。変更は家族と共有されます。</p></header>
    <div className="planner-view" aria-label="表示期間">
      <button type="button" aria-pressed={view === "week"} disabled={busy} onClick={() => navigate(data?.date ?? date, "week")}>週間</button>
      <button type="button" aria-pressed={view === "month"} disabled={busy} onClick={() => navigate(data?.date ?? date, "month")}>月間</button>
      <button type="button" disabled={busy} onClick={() => navigate(data?.today ?? "")}>今日へ</button>
    </div>
    {data && <div className="planner-navigation"><button type="button" disabled={busy || data.previousDate < "2020-01-01"} onClick={() => navigate(data.previousDate)}>前の{view === "week" ? "週" : "月"}</button><strong>{data.label}</strong><button type="button" disabled={busy || data.nextDate > "2100-12-31"} onClick={() => navigate(data.nextDate)}>次の{view === "week" ? "週" : "月"}</button></div>}
    {!online && <p className="warning-card">献立の変更には通信が必要です。通信を戻してからお試しください。</p>}
    {loading && <p className="loading" role="status">献立を確認中…</p>}
    {saving && <p className="notice-message" role="status">保存中…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {message && <p className="notice-message" role="status">{message}</p>}
    <button className="refresh-button" type="button" disabled={busy} onClick={() => { setMessage(""); setSaveError(""); setEpoch((value) => value + 1); }}>最新の献立を確認</button>
    {data?.days.length === 0 && <p className="empty">条件に合う献立がありません。Web版でメニューや家族の設定を確認してください。</p>}
    {view === "month" && data && data.days.length > 0 && <div className="planner-calendar" aria-label="月間の献立">
      {["月", "火", "水", "木", "金", "土", "日"].map((weekday) => <span className="calendar-weekday" key={weekday}>{weekday}</span>)}
      {Array.from({ length: leading }, (_, index) => <span key={`empty-${index}`} />)}
      {data.days.map((day) => <button type="button" key={day.date} disabled={busy} aria-pressed={day.date === selectedDay?.date} aria-current={day.date === data.today ? "date" : undefined}
        aria-label={`${dayLabel(day.date)} ${day.skipped ? "作らない日" : day.name}`} onClick={() => setDetailDate(day.date)}><strong>{Number(day.date.slice(-2))}</strong><span>{day.skipped ? "作らない日" : day.name}</span></button>)}
    </div>}
    {visibleDays.map((day) => <article className={`today-card planner-day${day.skipped ? " skipped-day" : ""}`} key={day.date} ref={view === "month" ? detailRef : undefined}>
      <p className="planner-date">{dayLabel(day.date)}{day.date === data?.today ? " · 今日" : ""}</p>
      <h2>{day.skipped ? "作らない日" : day.name}</h2>
      {day.skipped ? <p>この日の夕食の材料は買い物リストに含めません。朝食はそのままです。</p> : <><p className="today-side">{day.side}</p><p className="today-time">約{day.minutes}分{day.locked ? " · 固定中" : ""}</p></>}
      <div className="planner-actions">
        {!day.skipped && <><button type="button" disabled={busy || day.alternatives.length === 0} onClick={() => { setQuery(""); setPicker({ day, kind: "recipe" }); }}>主菜を変更</button>
        <button type="button" disabled={busy} onClick={() => setPicker({ day, kind: "side" })}>副菜を変更</button>
        <button type="button" aria-pressed={day.locked} disabled={busy} onClick={() => void save(day, { kind: "lock", locked: !day.locked })}>{day.locked ? "固定中" : "固定"}</button></>}
        <button type="button" aria-pressed={day.skipped} disabled={busy} onClick={() => void save(day, { kind: "skip", skipped: !day.skipped })}>{day.skipped ? "献立を戻す" : "この日は作らない"}</button>
      </div>
    </article>)}
    <dialog ref={dialogRef} className="planner-picker" aria-labelledby="planner-picker-title" onCancel={(event) => { if (savingRef.current) event.preventDefault(); else setPicker(null); }} onClose={() => setPicker(null)}>
      {picker && <><header><h2 id="planner-picker-title">{dayLabel(picker.day.date)}の{picker.kind === "recipe" ? "主菜" : "副菜"}</h2><button type="button" disabled={saving} onClick={() => setPicker(null)}>閉じる</button></header>
      <p>選ぶと保存し、買い物リストにも反映します。</p>
      {picker.kind === "recipe" ? <><label className="planner-search">料理名で検索<input value={query} onChange={(event) => setQuery(event.target.value)} type="search" /></label><p className="read-only-note">Web版と同じ家族の条件・40分以内の候補です。</p>
      <ul>{picker.day.alternatives.filter((recipe) => recipe.name.toLocaleLowerCase("ja").includes(query.trim().toLocaleLowerCase("ja"))).map((recipe) => <li key={recipe.id}><button type="button" disabled={busy} onClick={() => void save(picker.day, { kind: "recipe", recipeId: recipe.id })}><strong>{recipe.name}</strong><span>{recipe.side} · 約{recipe.minutes}分</span></button></li>)}</ul>
      {!picker.day.alternatives.some((recipe) => recipe.name.toLocaleLowerCase("ja").includes(query.trim().toLocaleLowerCase("ja"))) && <p>該当する料理がありません。</p>}
      </> : <ul>{[{ id: "default", name: "主菜に合う副菜に戻す" }, { id: "none", name: "副菜なし" }, ...(data?.sideDishes ?? [])].map((side) => <li key={side.id}><button type="button" disabled={busy} onClick={() => void save(picker.day, { kind: "side", mode: side.id === "default" || side.id === "none" ? side.id : "custom", sideDishId: side.id === "default" || side.id === "none" ? null : side.id })}>{side.name}</button></li>)}</ul>}
      {saving && <p role="status">保存中…</p>}
      </>}
    </dialog>
  </section>;
}
