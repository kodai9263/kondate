"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { addManualShoppingItem, deleteManualShoppingItem, setShoppingItemChecked } from "@/app/app/shopping/actions";
import { getShoppingBroadcastRecord, type ShoppingBroadcastItem } from "@/lib/realtime/shoppingItems";
import { buildShoppingItemKey } from "@/lib/services/shoppingService";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type ShoppingListItem = {
  id?: string;
  category: string;
  name: string;
  label: string;
  position: number;
  source?: "auto" | "manual";
};

export type ShoppingListGroup = {
  category: string;
  items: ShoppingListItem[];
};

type ManualItem = ShoppingListItem & { id: string; source: "manual" };

export function ShoppingList({
  groups,
  initialManualItems,
  initialCheckedKeys,
  listId,
  weekIndex,
  weekStart,
  loadError = false,
}: {
  groups: ShoppingListGroup[];
  initialManualItems: Array<{ id: string; category: string; name: string; position: number; checked: boolean; source: "manual" }>;
  initialCheckedKeys: string[];
  listId: string | null;
  weekIndex: number;
  weekStart: string;
  loadError?: boolean;
}) {
  const [checkedKeys, setCheckedKeys] = useState(() => new Set(initialCheckedKeys));
  const [manualItems, setManualItems] = useState<ManualItem[]>(() => initialManualItems.map(toManualItem));
  const [pendingKeys, setPendingKeys] = useState(() => new Set<string>());
  const [newItemName, setNewItemName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState(loadError ? "チェック状態を読み込めませんでした。" : "");
  const totalCount = groups.reduce((total, group) => total + group.items.length, 0) + manualItems.length;
  const checkedCount = checkedKeys.size;

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !listId) return;
    let cancelled = false;

    const channel = supabase.channel(`shopping-list:${listId}`, { config: { private: true } });
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel
        .on("broadcast", { event: "*" }, (payload) => {
          const row = getShoppingBroadcastRecord(payload);
          if (!row) return;
          const itemKey = buildShoppingItemKey(row.category, row.name);
          if (row.source === "manual") {
            if (row.eventType === "DELETE") {
              setManualItems((current) => current.filter((item) => item.id !== row.id));
              setCheckedKeys((current) => updateSet(current, itemKey, false));
              return;
            }
            setManualItems((current) => upsertManualItem(current, row));
          }
          setCheckedKeys((current) => updateSet(current, itemKey, row.checked));
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setError("家族との自動同期が一時停止しています。保存は続けられます。");
          }
        });
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [listId]);

  async function toggleItem(item: ShoppingListItem) {
    const itemKey = buildShoppingItemKey(item.category, item.name);
    const wasChecked = checkedKeys.has(itemKey);
    const nextChecked = !wasChecked;
    setError("");
    setCheckedKeys((current) => updateSet(current, itemKey, nextChecked));
    setPendingKeys((current) => updateSet(current, itemKey, true));

    const result = await setShoppingItemChecked({
      id: item.id,
      source: item.source ?? "auto",
      weekIndex,
      weekStart,
      category: item.category,
      name: item.name,
      position: item.position,
      checked: nextChecked,
    });

    setPendingKeys((current) => updateSet(current, itemKey, false));
    if (!result.ok) {
      setCheckedKeys((current) => updateSet(current, itemKey, wasChecked));
      setError("保存できませんでした。通信状態を確認して、もう一度お試しください。");
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newItemName.trim();
    if (!name || isAdding) return;
    setError("");
    setIsAdding(true);
    const result = await addManualShoppingItem({ weekStart, name });
    setIsAdding(false);
    if (!result.ok || !result.item) {
      setError("追加できませんでした。通信状態を確認して、もう一度お試しください。");
      return;
    }
    setManualItems((current) => upsertManualItem(current, result.item!));
    setNewItemName("");
  }

  async function deleteItem(item: ManualItem) {
    if (pendingKeys.has(item.id)) return;
    setError("");
    setPendingKeys((current) => updateSet(current, item.id, true));
    const result = await deleteManualShoppingItem({ weekStart, id: item.id });
    setPendingKeys((current) => updateSet(current, item.id, false));
    if (!result.ok) {
      setError("削除できませんでした。通信状態を確認して、もう一度お試しください。");
      return;
    }
    setManualItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setCheckedKeys((current) => updateSet(current, buildShoppingItemKey(item.category, item.name), false));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addItem} className="flex gap-2" aria-label="買うものを追加">
        <label className="min-w-0 flex-1">
          <span className="sr-only">買うもの</span>
          <input value={newItemName} onChange={(event) => setNewItemName(event.target.value)} maxLength={200} placeholder="買うものを追加" className="min-h-12 w-full rounded border border-kondate-line bg-white px-3 text-base outline-none placeholder:text-kondate-faint focus:border-kondate-ink" />
        </label>
        <button type="submit" aria-label="追加" disabled={isAdding || !newItemName.trim()} className="grid size-12 shrink-0 place-items-center rounded bg-kondate-ink text-white transition-colors hover:bg-kondate-accent disabled:opacity-30"><Plus size={20} /></button>
      </form>

      <section className="border-y border-kondate-line py-4" aria-label="買い物の進捗">
        <div className="flex items-center justify-between gap-4">
          <p aria-live="polite" className="text-sm tabular-nums">{checkedCount}/{totalCount}品 完了</p>
          <p className="text-xs tabular-nums text-kondate-faint">残り {Math.max(totalCount - checkedCount, 0)}品</p>
        </div>
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-kondate-line"><div className="h-full rounded-full bg-kondate-done transition-[width] duration-200 motion-reduce:transition-none" style={{ width: totalCount === 0 ? "0%" : `${(checkedCount / totalCount) * 100}%` }} /></div>
      </section>

      {error ? <p role="alert" className="rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm text-kondate-alert">{error}</p> : null}

      <div className="space-y-7">
        {manualItems.length > 0 ? <ShoppingGroup category="追加したもの" items={manualItems} checkedKeys={checkedKeys} pendingKeys={pendingKeys} onToggle={toggleItem} onDelete={deleteItem} /> : null}
        {groups.map((group) => <ShoppingGroup key={group.category} category={group.category} items={group.items} checkedKeys={checkedKeys} pendingKeys={pendingKeys} onToggle={toggleItem} />)}
      </div>
    </div>
  );
}

function ShoppingGroup({ category, items, checkedKeys, pendingKeys, onToggle, onDelete }: { category: string; items: ShoppingListItem[]; checkedKeys: Set<string>; pendingKeys: Set<string>; onToggle: (item: ShoppingListItem) => void; onDelete?: (item: ManualItem) => void }) {
  return <section aria-labelledby={`shopping-${category}`}><h2 id={`shopping-${category}`} className="border-b border-kondate-line pb-2 text-sm font-semibold">{category}<span className="ml-2 text-xs font-normal tabular-nums text-kondate-faint">{items.length}品</span></h2><div className="mt-2 divide-y divide-kondate-line">{items.map((item) => { const itemKey = buildShoppingItemKey(item.category, item.name); const checked = checkedKeys.has(itemKey); const pending = pendingKeys.has(itemKey) || (item.id ? pendingKeys.has(item.id) : false); return <div key={item.id ?? itemKey} className="grid grid-cols-[minmax(0,1fr)_44px] items-center"><button type="button" aria-pressed={checked} disabled={pending} onClick={() => onToggle(item)} className="grid min-h-12 w-full cursor-pointer grid-cols-[26px_1fr] items-center gap-3 py-2 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kondate-ink disabled:cursor-wait disabled:opacity-50"><span className={["flex size-[26px] items-center justify-center rounded-full border transition-colors", checked ? "border-kondate-done bg-kondate-done text-white" : "border-kondate-line bg-white text-transparent"].join(" ")}><Check size={15} strokeWidth={2.5} aria-hidden="true" /></span><span className={["text-[15px] leading-7", checked ? "text-kondate-faint line-through" : "text-kondate-ink"].join(" ")}>{item.label}</span></button>{onDelete && item.id && item.source === "manual" ? <button type="button" aria-label={`${item.name}を削除`} disabled={pending} onClick={() => onDelete(item as ManualItem)} className="grid size-11 place-items-center text-kondate-faint transition-colors hover:text-kondate-alert disabled:opacity-40"><Trash2 size={18} /></button> : <span />}</div>; })}</div></section>;
}

function updateSet(current: Set<string>, key: string, included: boolean): Set<string> {
  const next = new Set(current);
  if (included) next.add(key); else next.delete(key);
  return next;
}

function toManualItem(item: { id: string; category: string; name: string; position: number; source: "manual" }): ManualItem {
  return { ...item, label: item.name };
}

function upsertManualItem(current: ManualItem[], item: Omit<ShoppingBroadcastItem, "eventType">): ManualItem[] {
  const next = current.filter((currentItem) => currentItem.id !== item.id);
  return [...next, toManualItem({ ...item, source: "manual" })].sort((a, b) => a.position - b.position);
}
