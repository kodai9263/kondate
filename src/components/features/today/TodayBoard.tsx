import { CalendarDays, ChefHat, Clock, Flame, Wheat } from "lucide-react";
import { menuData } from "@/lib/menuData";
import { findTodayPlan } from "@/lib/services/planService";
import { CheckRow } from "@/components/ui/CheckRow";
import { formatServingLabel, scaleQuantityText, type FamilySize } from "@/lib/family/servings";
import { MealFeedbackForm } from "@/components/features/feedback/MealFeedbackForm";

export function TodayBoard({ familySize, feedbackStatus }: { familySize: FamilySize; feedbackStatus?: string }) {
  const today = findTodayPlan(menuData);
  const totalTasks = today.breakfast.tasks.length + today.dinner.morning.length + today.dinner.evening.length;

  return (
    <section className="space-y-4">
      <div className="border-2 border-kondate-ink bg-white p-5"><p className="text-xs font-black text-kondate-accent">今日の夕ごはん</p><p className="font-mincho mt-2 text-2xl font-black">{today.dinner.dinner}</p><p className="mt-2 text-sm text-kondate-muted">{today.dinner.side}</p></div>
      <div className="rounded-lg border border-kondate-line bg-kondate-surface p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-kondate-accent">
              <CalendarDays size={16} />
              今日やること
            </p>
            <h1 className="mt-1 text-2xl font-black">{today.date}</h1>
            <p className="mt-1 text-sm text-kondate-muted">開いて5秒で、次の一手だけを見るための画面です。</p>
          </div>
          <div className="grid size-16 place-items-center rounded-full bg-kondate-accentSoft text-center">
            <span className="text-sm font-black text-kondate-accent">0/{totalTasks}</span>
          </div>
        </div>
      </div>

      <MealBlock
        icon={<Wheat size={18} />}
        tone="bg-[#fff8df] text-[#8b6508]"
        title={`朝ごはん(${today.breakfast.minutes}分)`}
        subtitle={today.breakfast.name}
        items={today.breakfast.tasks}
      />

      <div className="rounded-lg border border-kondate-line bg-kondate-surface p-4">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#f3eefb] px-3 py-1 text-xs font-black text-[#6741d9]">
          <ChefHat size={14} />
          調味料・分量
        </p>
        <p className="mb-3 text-xs font-bold text-kondate-muted">{formatServingLabel(familySize)}</p>
        <div className="space-y-2">
          {today.dinner.seasonings.map((item) => (
            <p key={item} className="pl-3 text-sm leading-6 text-kondate-ink before:mr-2 before:text-[#6741d9] before:content-['・']">
              {scaleQuantityText(item, familySize)}
            </p>
          ))}
        </div>
      </div>

      <MealBlock
        icon={<Clock size={18} />}
        tone="bg-kondate-morning text-[#8b6508]"
        title={`朝の仕込み(${today.dinner.prepMin}分)`}
        subtitle={today.dinner.dinner}
        items={today.dinner.morning}
      />

      <MealBlock
        icon={<Flame size={18} />}
        tone="bg-kondate-evening text-[#3155a4]"
        title={`夜の手順(${today.dinner.cookMin}分)`}
        subtitle={`${today.dinner.dinner} / ${today.dinner.side}`}
        items={today.dinner.evening}
      />

      <MealFeedbackForm servedOn={today.date} recipeName={today.dinner.dinner} status={feedbackStatus} />

      <button className="min-h-12 w-full rounded-lg border border-kondate-accent bg-kondate-accentSoft px-4 font-black text-kondate-accent">
        今日は無理
      </button>
    </section>
  );
}

function MealBlock({
  icon,
  tone,
  title,
  subtitle,
  items,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  subtitle: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg border border-kondate-line bg-kondate-surface p-4">
      <p className={`mb-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${tone}`}>
        {icon}
        {title}
      </p>
      <h2 className="mb-3 text-lg font-black leading-snug">{subtitle}</h2>
      <div className="space-y-1">
        {items.map((item) => (
          <CheckRow key={item}>{item}</CheckRow>
        ))}
      </div>
    </section>
  );
}
