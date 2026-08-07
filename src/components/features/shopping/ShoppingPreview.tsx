import { ShoppingCart } from "lucide-react";
import { menuData } from "@/lib/menuData";
import { orderShoppingEntries } from "@/lib/services/shoppingService";
import { CheckRow } from "@/components/ui/CheckRow";
import { formatFamilyLabel, formatShoppingDay, scaleQuantityText, type FamilySize } from "@/lib/family/servings";

export function ShoppingPreview({ familySize, shoppingDay }: { familySize: FamilySize; shoppingDay: number }) {
  const week = menuData.weeks[0];
  const shoppingDayLabel = formatShoppingDay(shoppingDay);

  return (
    <section className="rounded-lg border border-kondate-line bg-kondate-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <ShoppingCart size={20} />
          {shoppingDayLabel}曜の買い物
        </h2>
        <span className="rounded-full bg-kondate-bg px-3 py-1 text-xs font-bold text-kondate-muted">{week.label}</span>
      </div>
      <p className="mb-4 text-xs font-bold text-kondate-muted">{formatFamilyLabel(familySize)}の1週間分の目安</p>
      <div className="space-y-4">
        {orderShoppingEntries(week.shopping).map(([category, items]) => (
          <details key={category} open={category !== "調味料(在庫確認)"} className="group">
            <summary className="min-h-11 cursor-pointer list-none rounded-lg bg-kondate-bg px-3 py-2 text-sm font-black text-kondate-muted">
              {category}
            </summary>
            <div className="mt-2 space-y-1">
              {items.map((item) => (
                <CheckRow key={`${category}-${item}`}>{scaleQuantityText(item, familySize)}</CheckRow>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
