import { Heart, Meh, ThumbsDown } from "lucide-react";
import { submitMealFeedback } from "@/app/feedback/actions";

export function MealFeedbackForm({ servedOn, recipeName, status }: { servedOn: string; recipeName: string; status?: string }) {
  return (
    <section className="border border-kondate-line bg-white p-4">
      <div><p className="text-xs font-black text-kondate-accent">献立フィードバック</p><h2 className="mt-1 text-lg font-black">この献立、どうだった？</h2></div>
      {status === "thanks" ? <p role="status" className="mt-3 bg-kondate-sage p-3 text-sm font-bold text-[#285b35]">評価を保存しました。次回の献立づくりに反映します。</p> : null}
      {status === "error" ? <p role="alert" className="mt-3 bg-red-50 p-3 text-sm font-bold text-red-800">評価を保存できませんでした。時間をおいてお試しください。</p> : null}
      <form action={submitMealFeedback} className="mt-4">
        <input type="hidden" name="servedOn" value={servedOn} />
        <input type="hidden" name="recipeName" value={recipeName} />
        <label className="block text-xs font-black text-kondate-muted">理由（任意）<select name="reason" defaultValue="" className="mt-2 min-h-11 w-full border border-kondate-line bg-white px-3 text-sm text-kondate-ink"><option value="">選択しない</option><option value="family_loved">家族に好評だった</option><option value="easy">作りやすかった</option><option value="too_much">量が多かった</option><option value="too_little">量が少なかった</option><option value="too_slow">時間がかかった</option><option value="taste">味が合わなかった</option></select></label>
        <div className="mt-3 grid grid-cols-3 gap-2"><button type="submit" name="rating" value="love" className="flex min-h-12 flex-col items-center justify-center gap-1 border border-[#8fb99a] bg-[#edf6ef] px-2 text-xs font-black text-[#285b35]"><Heart size={18} />家族に好評</button><button type="submit" name="rating" value="ok" className="flex min-h-12 flex-col items-center justify-center gap-1 border border-kondate-line bg-white px-2 text-xs font-black text-kondate-ink"><Meh size={18} />普通</button><button type="submit" name="rating" value="avoid" className="flex min-h-12 flex-col items-center justify-center gap-1 border border-[#e2b2a8] bg-[#fff5f2] px-2 text-xs font-black text-[#8e321e]"><ThumbsDown size={18} />もう出さない</button></div>
      </form>
    </section>
  );
}
