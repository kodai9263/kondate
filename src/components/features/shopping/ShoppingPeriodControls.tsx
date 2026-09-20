"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check } from "lucide-react";
import { changeShoppingPeriod } from "@/app/app/shopping/actions";
import { Button } from "@/components/ui/Button";
import { isShoppingRange, maxShoppingDays, type ShoppingPeriod, type ShoppingPeriodMode } from "@/lib/shopping/period";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;

function formatDateChoice(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "日付を選択";
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}年${month}月${day}日（${weekday}）`;
}

function DatePickerRow({ label, value, min, disabled, onChange }: {
  label: string;
  value: string;
  min?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return <label className={["relative grid min-h-14 cursor-pointer grid-cols-[3rem_1fr_auto] items-center gap-2 px-3 transition-colors focus-within:bg-kondate-paper", disabled ? "cursor-wait opacity-50" : "hover:bg-kondate-paper"].join(" ")}>
    <span className="text-xs font-semibold text-kondate-muted">{label}</span>
    <span className="min-w-0 tabular-nums text-[15px] font-semibold">{formatDateChoice(value)}</span>
    <CalendarDays size={18} className="text-kondate-muted" aria-hidden="true" />
    <input type="date" required value={value} min={min} disabled={disabled} aria-label={`${label}日`}
      onChange={(event) => onChange(event.target.value)}
      className="absolute inset-0 size-full cursor-pointer opacity-0 focus:outline-none disabled:cursor-wait" />
  </label>;
}

export function ShoppingPeriodControls({ period }: { period: ShoppingPeriod }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null);
  const selectedMode = draft ? "custom" : period.mode;
  const dates = draft ?? { start: period.start, end: period.end };
  const hasCustomChanges = period.mode !== "custom" || dates.start !== period.start || dates.end !== period.end;
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
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">日付を選ぶ</legend>
        <div className="divide-y divide-kondate-line overflow-hidden rounded-xl border border-kondate-line bg-white focus-within:ring-2 focus-within:ring-kondate-ink focus-within:ring-offset-2">
          <DatePickerRow label="開始" value={dates.start} disabled={pending}
            onChange={(start) => { setDraft({ ...dates, start }); setError(""); }} />
          <DatePickerRow label="終了" value={dates.end} min={dates.start} disabled={pending}
            onChange={(end) => { setDraft({ ...dates, end }); setError(""); }} />
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-sm leading-6 text-kondate-alert">{error}</p> : null}
      {hasCustomChanges ? <Button type="submit" variant="ink" fullWidth disabled={pending}>この期間に変更</Button>
        : <p className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-kondate-muted"><Check size={17} aria-hidden="true" />この期間を表示中</p>}
    </form> : null}
    {pending ? <p role="status" className="text-sm">期間を更新しています…</p> : null}
    {selectedMode !== "custom" && error ? <p role="alert" className="text-sm text-kondate-alert">{error}</p> : null}
  </div>;
}
