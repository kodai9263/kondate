import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ShoppingSummaryLink({ shoppingDayLabel, itemCount, periodLabel, loadError = false }: { shoppingDayLabel: string; itemCount: number; periodLabel?: string; loadError?: boolean }) {
  return (
    <Link
      href="/app/shopping"
      prefetch={false}
      className="flex min-h-16 items-center gap-3 rounded border border-kondate-line bg-white px-4 py-3 transition-colors hover:bg-kondate-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondate-ink"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">買い物リスト</span>
        <span className="mt-0.5 block text-xs text-kondate-faint">{periodLabel ?? `${shoppingDayLabel}曜から7日分`}{loadError ? "" : ` ${itemCount}品`}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-kondate-faint" aria-hidden="true" />
    </Link>
  );
}
