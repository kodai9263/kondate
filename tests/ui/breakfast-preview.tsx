import { createRoot } from "react-dom/client";
import { BreakfastSettings } from "@/components/features/account/BreakfastSettings";
import { breakfastForDate, breakfastShoppingForWeek, type BreakfastVersion } from "@/lib/breakfast/settings";

async function render() {
  const { versions, tomorrow } = await (await fetch("/state")).json() as { versions: BreakfastVersion[]; tomorrow: string };
  createRoot(document.getElementById("root")!).render(<main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-16 pt-5">
    <p className="text-xs text-kondate-muted">ローカル検証用 · 保存先は一時DB</p>
    <h1 className="mt-4 font-mincho text-[26px] font-bold">家族と契約の設定</h1>
    <BreakfastSettings initialVersion={versions.at(-1)} />
    <details className="mt-6"><summary>検証用の翌日表示</summary>
      <p>{breakfastForDate(versions, tomorrow)?.name ?? "朝食なし"}</p>
      <p>{breakfastShoppingForWeek(versions, tomorrow).join("・")}</p>
    </details>
    <a className="mt-6 block text-sm underline" href="/account?failure=1">通信エラー時の確認へ</a>
    <a className="mt-3 block text-sm underline" href="/account">通常の確認へ</a>
  </main>);
}
void render();
