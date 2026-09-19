"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeShoppingPeriod } from "@/app/app/shopping/actions";
import { Button } from "@/components/ui/Button";
import { isShoppingRange, maxShoppingDays, type ShoppingPeriod, type ShoppingPeriodMode } from "@/lib/shopping/period";

export function ShoppingPeriodControls({ period }: { period: ShoppingPeriod }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null);
  const selectedMode = draft ? "custom" : period.mode;
  const dates = draft ?? { start: period.start, end: period.end };
  useEffect(() => {
    // 日付変更や他画面での献立編集を、開いたままのリストにも反映する。
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  function change(mode: ShoppingPeriodMode) {
    setError("");
    if (mode === "custom" && !isShoppingRange(dates.start, dates.end)) {
      setError(dates.end < dates.start ? "終了日は開始日以降にしてください。" : `開始日と終了日を${maxShoppingDays}日以内で指定してください。`);
      return;
    }
    startTransition(async () => {
      try {
        const result = await changeShoppingPeriod({
          weekStart: period.storageWeekStart, rangeStart: period.start, rangeEnd: period.end, periodMode: period.mode,
          mode, ...(mode === "custom" ? dates : {}),
        });
        if (result.ok) setDraft(null);
        else setError("期間を変更できませんでした。もう一度お試しください。");
      } catch { setError("期間を変更できませんでした。もう一度お試しください。"); }
      router.refresh();
    });
  }
  return <div className="mt-4 space-y-3" aria-busy={pending}>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="買い物の期間">
      {([{ mode: "today", label: "今日だけ" }, { mode: "week", label: "7日間" }, { mode: "custom", label: "期間指定" }] as const).map(({ mode, label }) =>
        <Button key={mode} variant={selectedMode === mode ? "ink" : "secondary"} className="min-w-0 px-2"
          aria-pressed={selectedMode === mode} disabled={pending} onClick={() => {
            if (mode === "custom") { setDraft(dates); setError(""); }
            else if (period.mode === mode) { setDraft(null); setError(""); }
            else change(mode);
          }}>{label}</Button>)}
    </div>
    {selectedMode === "custom" ? <form className="space-y-3" aria-label="期間指定" onSubmit={(event) => { event.preventDefault(); change("custom"); }}>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1 text-sm"><span>開始日</span>
          <input type="date" required value={dates.start} disabled={pending}
            onChange={(event) => { setDraft({ ...dates, start: event.target.value }); setError(""); }}
            className="block min-h-12 w-full min-w-0 appearance-none rounded-lg border border-kondate-line bg-white px-2 text-base focus:outline-none focus:ring-2 focus:ring-kondate-ink" />
        </label>
        <label className="min-w-0 space-y-1 text-sm"><span>終了日</span>
          <input type="date" required value={dates.end} min={dates.start} disabled={pending}
            onChange={(event) => { setDraft({ ...dates, end: event.target.value }); setError(""); }}
            className="block min-h-12 w-full min-w-0 appearance-none rounded-lg border border-kondate-line bg-white px-2 text-base focus:outline-none focus:ring-2 focus:ring-kondate-ink" />
        </label>
      </div>
      <Button type="submit" variant="ink" fullWidth disabled={pending || (period.mode === "custom" && dates.start === period.start && dates.end === period.end)}>この期間にする</Button>
    </form> : null}
    {pending ? <p role="status" className="text-sm">期間を更新しています…</p> : null}
    {error ? <p role="alert" className="text-sm text-kondate-alert">{error}</p> : null}
  </div>;
}
