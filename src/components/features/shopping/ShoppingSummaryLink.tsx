import Link from "next/link";
import { ChevronRight, ShoppingCart } from "lucide-react";

export function ShoppingSummaryLink({ shoppingDayLabel, itemCount }: { shoppingDayLabel: string; itemCount: number }) {
  return (
    <Link
      href="/app/shopping"
      className="flex min-h-20 items-center gap-3 rounded-lg border border-kondate-line bg-white px-4 py-3 transition-colors hover:bg-kondate-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondate-accent focus-visible:ring-offset-2"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-kondate-accentSoft text-kondate-accent">
        <ShoppingCart size={21} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">基本の買い物リスト</span>
        <span className="mt-0.5 block text-xs font-bold text-kondate-muted">{shoppingDayLabel}曜向け {itemCount}品</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-kondate-muted" aria-hidden="true" />
    </Link>
  );
}
