import { ShoppingList } from "./ShoppingList";
import { ShoppingPeriodControls } from "./ShoppingPeriodControls";
import { formatFamilyLabel, type FamilySize } from "@/lib/family/servings";
import { formatShoppingPeriod, type ShoppingPeriod } from "@/lib/shopping/period";
import type { PlannedShoppingGroup } from "@/lib/shopping/build";

export type ShoppingPageData = {
  period: ShoppingPeriod; groups: PlannedShoppingGroup[]; warnings: string[];
  meals: Array<{ date: string; dinner: string | null; breakfast: string | null }>;
  preferences: FamilySize; listId: string | null;
  saved: { checkedKeys: string[]; dismissedKeys: string[]; manualItems: Array<{
    id: string; category: string; name: string; position: number; checked: boolean; source: "manual";
  }> };
};

export function ShoppingPageView({ period, groups, warnings, preferences, listId, saved }: ShoppingPageData) {
  const listGroups = groups.map((group) => ({ category: group.category, items: group.items.map(({ category, name, label, position }) => ({ category, name, label, position })) }));
  return <main className="mx-auto min-h-dvh w-full max-w-[640px] px-4 pb-28 pt-5">
    <header className="border-b border-kondate-line pb-5">
      <h1 className="font-mincho text-[26px] font-bold">買い物リスト</h1>
      <p className="mt-2 text-lg font-semibold">{formatShoppingPeriod(period.start, period.end)}</p>
      <p className="mt-1.5 text-sm text-kondate-muted">{formatFamilyLabel(preferences)}</p>
      <ShoppingPeriodControls period={period} />
    </header>
    {warnings.length ? <details className="mt-4 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm leading-7 text-kondate-alert">
      <summary className="cursor-pointer font-semibold">材料の確認が必要です（{warnings.length}件）</summary>
      <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </details> : null}
    <div className="mt-5"><ShoppingList key={period.storageWeekStart} groups={listGroups}
      initialManualItems={saved.manualItems} initialCheckedKeys={saved.checkedKeys} initialDismissedKeys={saved.dismissedKeys}
      listId={listId} weekStart={period.storageWeekStart} rangeStart={period.start} rangeEnd={period.end} periodMode={period.mode} /></div>
  </main>;
}
