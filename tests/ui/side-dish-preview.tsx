/* eslint-disable @next/next/no-html-link-for-pages -- Nextを介さず再読込するローカル検証専用画面 */
// 本番データを使わず、実コンポーネントと一時DBで保存・再読込を確認する。
import { useEffect, useState, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { TodayBoard } from "@/components/features/today/TodayBoard";
import type { PlannedShoppingGroup } from "@/lib/shopping/build";

type State = { planner: ComponentProps<typeof MonthlyPlanner>; today: ComponentProps<typeof TodayBoard>; shopping: { groups: PlannedShoppingGroup[] } };
function Preview() {
  const [data, setData] = useState<State | null>(null);
  useEffect(() => { fetch('/state').then((response) => response.json()).then(setData); }, []);
  if (!data) return <p>読み込み中...</p>;
  const view = new URLSearchParams(location.search).get('view');
  return <><nav className="flex flex-wrap gap-4 bg-white p-3 text-sm"><span>ローカル検証（9/1・4人分）</span><a href="/">献立</a><a href="/?view=today">今日</a><a href="/?view=shopping">買い物</a></nav>
    {view === 'today' ? <main className="mx-auto max-w-[560px] p-4"><TodayBoard {...data.today} /></main>
      : view === 'shopping' ? <main className="mx-auto max-w-[640px] p-4"><h1>買い物リスト（9/1）</h1>{data.shopping.groups.map((group) => <section key={group.category}><h2>{group.category}</h2><ul>{group.items.map((item) => <li key={item.name}>{item.label}</li>)}</ul></section>)}</main>
      : <MonthlyPlanner {...data.planner} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
