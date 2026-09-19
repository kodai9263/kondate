"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { saveBreakfastSettings } from "@/app/account/breakfast-actions";
import { breakfastItemSchema, breakfastSettingsSchema, breakfastTemplates, splitBreakfastLines, type BreakfastItem, type BreakfastSettings as Settings, type BreakfastVersion } from "@/lib/breakfast/settings";
import { Button } from "@/components/ui/Button";

type Editor = { item: BreakfastItem; shoppingText: string; tasksText: string; minutesText: string; isNew: boolean };
const inputClass = "mt-2 w-full rounded-lg border border-kondate-line bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accent/15";

function openEditor(item: BreakfastItem, isNew: boolean): Editor {
  return { item, isNew, shoppingText: item.shoppingItems.join("\n"), tasksText: item.tasks.join("\n"), minutesText: item.minutes?.toString() ?? "" };
}

export function BreakfastSettings({ initialVersion, loadError = false }: { initialVersion?: BreakfastVersion; loadError?: boolean }) {
  const initial: Settings = { enabled: initialVersion?.enabled ?? false, items: initialVersion?.items ?? [] };
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [revision, setRevision] = useState(initialVersion?.revision ?? "");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== saved || editor !== null;

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const click = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.("a[href]");
      if (link && !window.confirm("保存していない朝食の変更があります。この画面を離れますか？")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const navigate = (event: Event) => {
      if ((event as Event & { navigationType?: string }).navigationType === "traverse"
        && event.cancelable && !window.confirm("保存していない朝食の変更があります。この画面を離れますか？")) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); navigation?.removeEventListener("navigate", navigate); };
  }, [dirty]);

  useEffect(() => {
    if (editor) editorRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [editor?.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function readEditor(): BreakfastItem | null {
    if (!editor) return null;
    const parsed = breakfastItemSchema.safeParse({ ...editor.item, shoppingItems: splitBreakfastLines(editor.shoppingText), tasks: splitBreakfastLines(editor.tasksText), minutes: editor.minutesText.trim() ? Number(editor.minutesText) : null });
    if (!parsed.success) {
      setError("名前は1〜80文字、買うもの・作り方は各20行まで、目安時間は1〜120分で入力してください。");
      return null;
    }
    return parsed.data;
  }

  function withEditor(item: BreakfastItem): Settings {
    return { ...draft, items: editor?.isNew ? [...draft.items, item] : draft.items.map((row) => row.id === item.id ? item : row) };
  }

  function finishEditor() {
    const item = readEditor();
    if (!item) return;
    setDraft(withEditor(item)); setEditor(null); setAdding(false); setError(""); setNotice("");
  }

  function startAdding() {
    setAdding(true); setOrdering(false); setNotice("");
  }

  function chooseTemplate(sourceKey: string | null) {
    const template = breakfastTemplates.find((item) => item.sourceKey === sourceKey);
    const item: BreakfastItem = template
      ? { ...template, id: crypto.randomUUID(), sourceKey: template.sourceKey as BreakfastItem["sourceKey"] }
      : { id: crypto.randomUUID(), sourceKey: null, name: "", shoppingItems: [], tasks: [], minutes: null };
    setEditor(openEditor(item, true)); setAdding(false); setError("");
  }

  function move(index: number, offset: number) {
    setDraft((current) => {
      const items = [...current.items];
      [items[index], items[index + offset]] = [items[index + offset], items[index]];
      return { ...current, items };
    });
    setNotice("");
  }

  async function save() {
    if (saving) return;
    let next = draft;
    if (editor) {
      const item = readEditor();
      if (!item) return;
      next = withEditor(item);
    }
    const parsed = breakfastSettingsSchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveBreakfastSettings({ revision, settings: parsed.data });
      if (!result.ok) { setError(result.error); return; }
      setDraft(parsed.data); setSaved(JSON.stringify(parsed.data)); setRevision(result.revision);
      setEditor(null); setAdding(false);
      const [, month, day] = result.effectiveDate.split("-");
      setNotice(result.changed ? `朝食の設定を保存しました。${Number(month)}月${Number(day)}日から反映されます。` : "保存済みの内容から変更はありません。");
    } catch {
      setError("朝食を保存できませんでした。入力は残っています。もう一度お試しください。");
    } finally { setSaving(false); }
  }

  return <section className="mt-4 rounded border border-kondate-line bg-white p-5" aria-labelledby="breakfast-heading">
    <h2 id="breakfast-heading" className="font-semibold">わが家の朝食</h2>
    <p className="mt-1 text-xs leading-6 text-kondate-muted">いつもの朝食を登録すると、順番に提案します。</p>
    {loadError || !initialVersion ? <p role="alert" className="mt-4 text-sm text-kondate-alert">朝食の設定を読み込めませんでした。再読み込みしてお試しください。</p> : <fieldset disabled={saving} className="mt-3 min-w-0 disabled:opacity-70">
      <label className="flex min-h-12 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-kondate-accent" checked={draft.enabled} disabled={Boolean(editor)} onChange={(event) => {
        const enabled = event.target.checked;
        setDraft({ ...draft, enabled }); setAdding(enabled && !draft.items.length); setNotice("");
      }} />朝食を提案する</label>
      {draft.enabled ? <>
        <ol className="divide-y divide-kondate-line border-y border-kondate-line">
          {draft.items.map((item, index) => <li key={item.id} className="flex min-h-14 items-center gap-2 py-2">
            <span className="w-4 shrink-0 text-xs tabular-nums text-kondate-faint">{index + 1}</span>
            <span className="min-w-0 flex-1 break-words text-sm font-semibold">{item.name}</span>
            {ordering ? <div className="flex shrink-0"><button type="button" aria-label={`${item.name}を上へ`} disabled={index === 0} onClick={() => move(index, -1)} className="p-3 disabled:opacity-25"><ArrowUp size={16} /></button><button type="button" aria-label={`${item.name}を下へ`} disabled={index === draft.items.length - 1} onClick={() => move(index, 1)} className="p-3 disabled:opacity-25"><ArrowDown size={16} /></button></div>
              : <button type="button" disabled={Boolean(editor)} onClick={() => { setEditor(openEditor(item, false)); setAdding(false); setNotice(""); setError(""); }} className="min-h-11 shrink-0 px-2 text-sm text-kondate-accent disabled:opacity-40">編集</button>}
          </li>)}
        </ol>
        {!editor ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={startAdding} disabled={draft.items.length >= 10} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-kondate-accent disabled:opacity-40"><Plus size={16} />朝食を追加</button>
          {draft.items.length > 1 ? <button type="button" onClick={() => { setOrdering(!ordering); setAdding(false); }} className="min-h-11 text-xs text-kondate-muted">{ordering ? "順番の変更を終える" : "順番を変更"}</button> : null}
        </div> : null}
        {draft.items.length >= 10 ? <p className="mt-1 text-xs text-kondate-muted">登録できる朝食は10件までです。</p> : null}
        {adding && !editor ? <div className="mt-3 rounded-lg border border-kondate-line bg-kondate-bg p-3">
          <h3 className="text-sm font-semibold">定番から選ぶ</h3>
          <p className="mt-1 text-xs leading-6 text-kondate-muted">そのまま使うことも、好みに編集することもできます。</p>
          <div className="mt-2 divide-y divide-kondate-line">{breakfastTemplates.map((item) => <button type="button" key={item.sourceKey} onClick={() => chooseTemplate(item.sourceKey)} className="flex min-h-14 w-full items-center gap-2 py-2 text-left">
            <span className="min-w-0 flex-1"><span className="block text-sm">{item.name}</span><span className="text-xs text-kondate-muted">{item.minutes}分{draft.items.some((row) => row.sourceKey === item.sourceKey) ? " ・ 使用中" : ""}</span></span><ChevronRight size={16} className="shrink-0" />
          </button>)}</div>
          <button type="button" onClick={() => chooseTemplate(null)} className="mt-2 min-h-11 text-sm font-semibold text-kondate-accent">＋ 自分で作る</button>
          <button type="button" onClick={() => setAdding(false)} className="ml-4 min-h-11 text-sm text-kondate-muted">閉じる</button>
        </div> : null}
        {editor ? <div ref={editorRef} className="mt-4 space-y-4 rounded-lg border border-kondate-line bg-kondate-bg p-4">
          <h3 className="text-sm font-semibold">{editor.isNew ? "朝食を追加" : "朝食を編集"}</h3>
          <label className="block text-sm font-semibold">朝食の名前<input aria-label="朝食の名前" maxLength={80} className={inputClass} value={editor.item.name} onChange={(event) => setEditor({ ...editor, item: { ...editor.item, name: event.target.value } })} /></label>
          <label className="block text-sm font-semibold">買うもの（1行に1品）<textarea aria-label="買うもの（1行に1品）" rows={3} maxLength={1620} className={inputClass} value={editor.shoppingText} onChange={(event) => setEditor({ ...editor, shoppingText: event.target.value })} /></label>
          <p className="text-xs leading-6 text-kondate-muted">ご家庭の1回分を「卵 2個」「牛乳 400ml」のように入力すると、食べる回数分を合計します。数量なしは「数量確認」と表示します。空欄の場合は材料未登録としてお知らせします。</p>
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">作り方・目安時間も設定する</summary>
            <label className="mt-2 block text-sm font-semibold">作り方（1行に1工程）<textarea aria-label="作り方（1行に1工程）" rows={4} maxLength={4020} className={inputClass} value={editor.tasksText} onChange={(event) => setEditor({ ...editor, tasksText: event.target.value })} /></label>
            <label className="mt-3 block text-sm font-semibold">目安時間（分）<input aria-label="目安時間（分）" type="number" min={1} max={120} className={inputClass} value={editor.minutesText} onChange={(event) => setEditor({ ...editor, minutesText: event.target.value })} /></label>
          </details>
          <p className="text-xs leading-6 text-kondate-muted">アレルギーのある食材が含まれないか、加工品の原材料も確認してください。</p>
          <div className="flex flex-wrap items-center gap-2"><Button type="button" onClick={finishEditor}>{editor.isNew ? "この内容で追加" : "編集を終える"}</Button><button type="button" onClick={() => { setEditor(null); setError(""); }} className="min-h-11 px-3 text-sm">取り消す</button></div>
          <div className="flex flex-wrap gap-x-4">
            {editor.item.sourceKey ? <button type="button" className="min-h-11 text-xs text-kondate-muted underline" onClick={() => {
              if (!window.confirm("名前・買うもの・作り方・時間を定番の内容に戻しますか？")) return;
              const template = breakfastTemplates.find((item) => item.sourceKey === editor.item.sourceKey)!;
              setEditor(openEditor({ ...editor.item, ...template, sourceKey: editor.item.sourceKey }, editor.isNew));
            }}>定番の内容に戻す</button> : null}
            {!editor.isNew ? <button type="button" className="min-h-11 text-xs text-kondate-alert underline" onClick={() => {
              if (!window.confirm(`「${editor.item.name}」を朝食の候補から外しますか？`)) return;
              setDraft({ ...draft, items: draft.items.filter((item) => item.id !== editor.item.id) }); setEditor(null);
            }}>この朝食を外す</button> : null}
          </div>
        </div> : null}
      </> : <p className="text-xs leading-6 text-kondate-muted">朝食の提案をお休みします。登録した内容は残ります。</p>}
      {error ? <p role="alert" className="mt-4 text-sm leading-6 text-kondate-alert">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded bg-kondate-doneSoft p-3 text-sm leading-6">{notice}</p> : null}
      <p className="mb-3 mt-5 text-xs text-kondate-muted">変更は明日から反映されます。</p>
      <Button type="button" fullWidth onClick={save} disabled={saving}>{saving ? "保存中…" : "朝食の設定を保存"}</Button>
    </fieldset>}
  </section>;
}
