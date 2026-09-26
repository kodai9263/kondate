"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { createSideDish, createStandardSideDish } from "@/app/app/planner/actions";
import { Button } from "@/components/ui/Button";
import { PlannerDialog } from "@/components/features/planner/PlannerDialog";
import { plannedSideName } from "@/lib/nutrition/planner";
import type { PlannedDinner, SideDish, SideMode } from "@/types/nutrition";

import { availableStandardSideDishes, standardSideDishes, standardSideServings, type StandardSideDish } from "@/lib/nutrition/standardSideDishes";
import { filterRecipesForAllergies } from "@/lib/family/allergies";

export function SideDishPicker({ day, sideDishes, allergies = [], demo, onClose, onSelect, onCreated }: {
  day: PlannedDinner; sideDishes: SideDish[]; allergies?: string[]; demo: boolean; onClose: () => void;
  onSelect: (mode: SideMode, sideDish?: SideDish | null) => Promise<boolean>;
  onCreated: (sideDish: SideDish) => void;
}) {
  const standardSides = availableStandardSideDishes(allergies);
  const customSides = filterRecipesForAllergies(sideDishes.filter((dish) => !dish.standardKey), allergies).allowed;
  const [form, setForm] = useState({ name: "", ingredientsText: "", stepsText: "" });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  async function select(mode: SideMode, sideDish?: SideDish) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (!await onSelect(mode, sideDish)) setError("献立へ反映できませんでした。もう一度お試しください。");
    } catch { setError("通信できませんでした。もう一度お試しください。"); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function create() {
    if (busyRef.current) return;
    if (!form.name.trim()) { setError("副菜名を入力してください。"); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = demo ? { ok: true, sideDish: { id: crypto.randomUUID(), name: form.name.trim(), ingredientsText: form.ingredientsText.trim(), steps: form.stepsText.split(/\r?\n/).map((step) => step.trim()).filter(Boolean) } } : await createSideDish(form);
      if (!result.ok || !result.sideDish) { setError("副菜を保存できませんでした。入力内容を確認してください。"); return; }
      onCreated(result.sideDish);
      if (!await onSelect("custom", result.sideDish)) {
        setShowForm(false);
        setForm({ name: "", ingredientsText: "", stepsText: "" });
        setError("副菜は登録しましたが、献立へ反映できませんでした。一覧からもう一度選んでください。");
      }
    } catch { setError("通信できませんでした。もう一度お試しください。"); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function selectStandard(dish: StandardSideDish) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const existing = sideDishes.find((side) => side.standardKey === dish.key);
      const result = demo ? { ok: true, sideDish: existing ?? {
        id: crypto.randomUUID(), name: dish.name, ingredientsText: dish.ingredientsText,
        steps: dish.steps, standardKey: dish.key, servingsBase: standardSideServings,
      } } : await createStandardSideDish(dish.key);
      if (!result.ok || !result.sideDish) { setError(result.message ?? "副菜を保存できませんでした。"); return; }
      onCreated(result.sideDish);
      if (!await onSelect("custom", result.sideDish)) setError("副菜は保存しましたが、献立へ反映できませんでした。もう一度選んでください。");
    } catch { setError("通信できませんでした。もう一度お試しください。"); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <PlannerDialog labelId="side-picker-title" onClose={() => { if (!busyRef.current) onClose(); }}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-kondate-line p-4"><div><h2 id="side-picker-title" className="font-mincho text-xl font-bold">副菜を変更</h2><p className="mt-1 text-sm text-kondate-muted">現在：{plannedSideName(day)}</p></div><Button variant="secondary" size="icon" aria-label="閉じる" disabled={busy} onClick={onClose}><X size={20} /></Button></header>
    <div className="overflow-y-auto p-4">
      {error ? <p role="alert" className="mb-3 text-sm text-kondate-alert">{error}</p> : null}
      {busy ? <p role="status" className="mb-3 text-sm">保存中…</p> : null}
      {showForm ? <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="space-y-4">
        <label className="block text-sm">副菜名<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-kondate-line px-3" /></label>
        <label className="block text-sm">材料・分量<textarea maxLength={4000} rows={3} value={form.ingredientsText} onChange={(event) => setForm({ ...form, ingredientsText: event.target.value })} className="mt-1 block w-full rounded-lg border border-kondate-line p-3" /></label>
        <label className="block text-sm">作り方（1行に1工程）<textarea maxLength={4000} rows={4} value={form.stepsText} onChange={(event) => setForm({ ...form, stepsText: event.target.value })} className="mt-1 block w-full rounded-lg border border-kondate-line p-3" /></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>保存してこの日に使う</Button><Button variant="secondary" disabled={busy} onClick={() => setShowForm(false)}>一覧に戻る</Button></div>
      </form> : <><div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" disabled={busy} onClick={() => void select("default")} className="min-h-20 flex-col items-start text-left"><span>{day.recipe.side}</span><span className="text-xs">標準の副菜に戻す</span></Button>
        <Button variant="secondary" disabled={busy} onClick={() => void select("none")} className="min-h-20">副菜なし</Button>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">定番の副菜</h3>
      <div className="grid gap-2 sm:grid-cols-2">{standardSides.map((dish) => <Button key={dish.key} variant="secondary" disabled={busy} onClick={() => void selectStandard(dish)} className="min-h-12 justify-start text-left font-mincho">{dish.name}</Button>)}</div>
      {standardSides.length < standardSideDishes.length ? <p className="mt-2 text-xs leading-6 text-kondate-muted">登録したアレルギーに該当する副菜は表示していません。調味料や加工品の原材料表示も確認してください。</p> : null}
      {customSides.length > 0 ? <><h3 className="mb-2 mt-5 text-sm font-semibold">わが家の副菜</h3><div className="grid gap-2 sm:grid-cols-2">{customSides.map((dish) => <Button key={dish.id} variant="secondary" disabled={busy} onClick={() => void select("custom", dish)} className="min-h-12 justify-start text-left font-mincho">{dish.name}</Button>)}</div></> : null}
      <Button variant="secondary" disabled={busy} fullWidth className="mt-4" onClick={() => setShowForm(true)}>新しい副菜を作る</Button></>}
    </div>
  </PlannerDialog>;
}
