import { Heart, Meh, ThumbsDown } from "lucide-react";
import { submitMealFeedback } from "@/app/feedback/actions";

export function MealFeedbackForm({ servedOn, recipeName, status }: { servedOn: string; recipeName: string; status?: string }) {
  return (
    <section className="rounded border border-kondate-line bg-white p-4">
      <h2 className="font-mincho text-lg font-bold">この献立、どうだった？</h2>
      <p className="mt-1 text-xs text-kondate-faint">次の献立づくりに反映します。</p>
      {status === "thanks" ? <p role="status" className="mt-3 rounded bg-kondate-doneSoft p-3 text-sm">評価を保存しました。</p> : null}
      {status === "error" ? <p role="alert" className="mt-3 rounded bg-kondate-alertSoft p-3 text-sm text-kondate-alert">評価を保存できませんでした。時間をおいてお試しください。</p> : null}
      <form action={submitMealFeedback} className="mt-4">
        <input type="hidden" name="servedOn" value={servedOn} />
        <input type="hidden" name="recipeName" value={recipeName} />
        <div className="grid grid-cols-3 gap-2">
          <button type="submit" name="rating" value="love" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-kondate-done/40 bg-kondate-doneSoft px-2 text-xs text-kondate-done transition-colors hover:border-kondate-done"><Heart size={17} aria-hidden="true" />家族に好評</button>
          <button type="submit" name="rating" value="ok" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-kondate-line bg-white px-2 text-xs text-kondate-muted transition-colors hover:border-kondate-ink"><Meh size={17} aria-hidden="true" />普通</button>
          <button type="submit" name="rating" value="avoid" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-kondate-alert/30 bg-kondate-alertSoft px-2 text-xs text-kondate-alert transition-colors hover:border-kondate-alert"><ThumbsDown size={17} aria-hidden="true" />もう出さない</button>
        </div>
      </form>
    </section>
  );
}
