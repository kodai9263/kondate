"use client";

import { useState } from "react";
import type { BreakfastKey } from "@/lib/breakfast/preferences";

type BreakfastOption = {
  key: BreakfastKey;
  name: string;
  minutes: number;
};

export function BreakfastChoiceFieldset({
  options,
  initialSelectedKeys,
}: {
  options: BreakfastOption[];
  initialSelectedKeys: BreakfastKey[];
}) {
  const [enabled, setEnabled] = useState(initialSelectedKeys.length > 0);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(initialSelectedKeys));

  function setBreakfastEnabled(nextEnabled: boolean) {
    setEnabled(nextEnabled);
    if (nextEnabled && selectedKeys.size === 0) {
      setSelectedKeys(new Set(options.map((option) => option.key)));
    }
  }

  function setBreakfastSelected(key: BreakfastKey, selected: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (selected) next.add(key);
      else next.delete(key);
      if (next.size === 0) setEnabled(false);
      return next;
    });
  }

  return (
    <fieldset className="border-t border-kondate-line pt-5">
      <legend className="px-1 font-semibold">朝食</legend>
      <label className="mt-3 flex min-h-12 items-center gap-3 rounded-lg border border-kondate-line bg-white px-3.5 text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          aria-controls="breakfast-choice-list"
          aria-expanded={enabled}
          onChange={(event) => setBreakfastEnabled(event.target.checked)}
          className="size-4 shrink-0 accent-kondate-accent"
        />
        朝食も作る
      </label>

      {enabled ? (
        <div id="breakfast-choice-list" className="mt-4">
          <p className="text-xs leading-6 text-kondate-muted">食べたいものだけ選ぶと、選んだ朝食を順番に提案します。</p>
          <div className="mt-3 grid gap-2">
            {options.map((option) => (
              <label key={option.key} className="flex min-h-12 items-start gap-3 rounded-lg border border-kondate-line bg-white px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  name="breakfastChoices"
                  value={option.key}
                  checked={selectedKeys.has(option.key)}
                  onChange={(event) => setBreakfastSelected(option.key, event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-kondate-accent"
                />
                <span>
                  <span className="block font-semibold text-kondate-ink">{option.name}</span>
                  <span className="mt-0.5 block text-xs text-kondate-muted">{option.minutes}分</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-6 text-kondate-muted">朝食は今日画面と買い物リストに表示しません。</p>
      )}
    </fieldset>
  );
}
