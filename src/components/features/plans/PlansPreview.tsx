import { Fish } from "lucide-react";
import { menuData } from "@/lib/menuData";
import { formatFamilyLabel, type FamilySize } from "@/lib/family/servings";

export function PlansPreview({ familySize }: { familySize: FamilySize }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">4週間の献立</h2>
        <span className="text-right text-xs font-black text-kondate-muted">{formatFamilyLabel(familySize)}用</span>
      </div>
      {menuData.weeks.map((week) => (
        <div key={week.label} className="rounded-lg border border-kondate-line bg-kondate-surface p-3">
          <h3 className="px-1 pb-2 text-sm font-black text-kondate-accent">{week.label}</h3>
          <div className="divide-y divide-kondate-line">
            {week.days.map((day) => (
              <div key={`${week.label}-${day.dow}`} className="grid min-h-12 grid-cols-[32px_1fr_auto] items-center gap-2 py-2">
                <span className="grid size-8 place-items-center rounded-lg bg-kondate-bg text-sm font-black text-kondate-muted">{day.dow}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-bold">
                    {day.dinner}
                    {day.fish ? <Fish size={14} className="text-[#3155a4]" /> : null}
                  </p>
                  <p className="text-xs text-kondate-muted">{day.side}</p>
                </div>
                <span className="text-xs font-bold text-kondate-muted">夜{day.cookMin}分</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
