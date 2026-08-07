import { Settings } from "lucide-react";
import Link from "next/link";
import { PlansPreview } from "@/components/features/plans/PlansPreview";
import { ShoppingPreview } from "@/components/features/shopping/ShoppingPreview";
import { TodayBoard } from "@/components/features/today/TodayBoard";
import { formatFamilyLabel, formatShoppingDay } from "@/lib/family/servings";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ mealFeedback?: string; notice?: string }> }) {
  const params = await searchParams;
  const preferences = await getCurrentHouseholdPreferences();
  const familySize = { adultCount: preferences.adultCount, childCount: preferences.childCount };
  const shoppingDayLabel = formatShoppingDay(preferences.shoppingDay);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-24 pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div><p className="text-sm font-black text-kondate-accent">きょうのごはん</p><p className="mt-1 text-sm text-kondate-muted">{formatFamilyLabel(familySize)}・日曜始まり・{shoppingDayLabel}曜まとめ買い</p></div>
        <div className="flex gap-2"><Link href="/pricing" className="inline-flex min-h-11 items-center rounded-lg bg-kondate-accentSoft px-3 text-xs font-black text-kondate-accent">家族プラン</Link><Link href="/account" aria-label="アカウント設定" title="アカウント設定" className="grid size-11 place-items-center rounded-lg border border-kondate-line bg-white text-kondate-muted"><Settings size={19} /></Link></div>
      </header>
      {params.notice === "family-joined" ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">家族グループに参加しました。</p> : null}
      <div className="space-y-8"><TodayBoard familySize={familySize} feedbackStatus={params.mealFeedback} /><PlansPreview familySize={familySize} /><ShoppingPreview familySize={familySize} shoppingDay={preferences.shoppingDay} /></div>
    </main>
  );
}
