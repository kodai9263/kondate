"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { setShoppingItemChecked } from "@/app/app/shopping/actions";
import { buildShoppingItemKey } from "@/lib/services/shoppingService";

export type ShoppingListItem = {
  category: string;
  name: string;
  label: string;
  position: number;
};

export type ShoppingListGroup = {
  category: string;
  items: ShoppingListItem[];
};

export function ShoppingList({
  groups,
  initialCheckedKeys,
  weekIndex,
  weekStart,
  loadError = false,
}: {
  groups: ShoppingListGroup[];
  initialCheckedKeys: string[];
  weekIndex: number;
  weekStart: string;
  loadError?: boolean;
}) {
  const [checkedKeys, setCheckedKeys] = useState(() => new Set(initialCheckedKeys));
  const [pendingKeys, setPendingKeys] = useState(() => new Set<string>());
  const [error, setError] = useState(loadError ? "チェック状態を読み込めませんでした。" : "");
  const totalCount = groups.reduce((total, group) => total + group.items.length, 0);
  const checkedCount = checkedKeys.size;

  async function toggleItem(item: ShoppingListItem) {
    const itemKey = buildShoppingItemKey(item.category, item.name);
    const wasChecked = checkedKeys.has(itemKey);
    const nextChecked = !wasChecked;

    setError("");
    setCheckedKeys((current) => updateSet(current, itemKey, nextChecked));
    setPendingKeys((current) => updateSet(current, itemKey, true));

    const result = await setShoppingItemChecked({
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

  return (
    <div className="space-y-6">
      <section className="border-y border-kondate-line bg-white px-4 py-4" aria-label="買い物の進捗">
        <div className="flex items-center justify-between gap-4">
          <p aria-live="polite" className="text-sm font-black">{checkedCount}/{totalCount}品 完了</p>
          <p className="text-xs font-bold text-kondate-muted">残り {Math.max(totalCount - checkedCount, 0)}品</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-kondate-bg">
          <div
            className="h-full rounded-full bg-[#4f9f58] transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: totalCount === 0 ? "0%" : `${(checkedCount / totalCount) * 100}%` }}
          />
        </div>
      </section>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}

      <div className="space-y-7">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`shopping-${group.category}`}>
            <h2 id={`shopping-${group.category}`} className="border-b-2 border-kondate-ink pb-2 text-base font-black">
              {group.category}
              <span className="ml-2 text-xs text-kondate-muted">{group.items.length}品</span>
            </h2>
            <div className="mt-2 divide-y divide-kondate-line">
              {group.items.map((item) => {
                const itemKey = buildShoppingItemKey(item.category, item.name);
                const checked = checkedKeys.has(itemKey);
                const pending = pendingKeys.has(itemKey);
                return (
                  <button
                    key={itemKey}
                    type="button"
                    aria-pressed={checked}
                    disabled={pending}
                    onClick={() => toggleItem(item)}
                    className="grid min-h-12 w-full cursor-pointer grid-cols-[32px_1fr] items-center gap-3 py-2 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kondate-accent disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className={["flex size-8 items-center justify-center rounded-full border-2 transition-colors", checked ? "border-[#4f9f58] bg-[#4f9f58] text-white" : "border-[#d9cfc4] bg-white text-transparent"].join(" ")}>
                      <Check size={17} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className={["text-sm font-bold leading-6", checked ? "text-kondate-muted line-through" : "text-kondate-ink"].join(" ")}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function updateSet(current: Set<string>, key: string, included: boolean): Set<string> {
  const next = new Set(current);
  if (included) next.add(key);
  else next.delete(key);
  return next;
}
