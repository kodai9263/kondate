// 実コンポーネントと一時DBを使う画面検証。公開サイトや実決済には接続しない。
import React from "react";
import { createRoot } from "react-dom/client";
import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import ShoppingPage from "@/app/app/shopping/page";
import FirstWeekSetupPage from "@/app/app/planner/setup/page";
import { PricingSection } from "@/components/features/billing/PricingSection";

const root = createRoot(document.getElementById("root")!);
async function render() {
  const access = await (await fetch("/access")).json();
  if (location.pathname === "/setup") {
    root.render(await FirstWeekSetupPage({ searchParams: Promise.resolve({}) }));
  } else if (location.pathname === "/app/shopping") {
    root.render(await ShoppingPage());
  } else if (location.pathname === "/pricing") {
    root.render(<main className="mx-auto max-w-xl p-6"><PricingSection requiredFeature={!access.canPlan ? "trial_expired" : undefined} /></main>);
  } else {
    const response = await fetch(`/planner-state${location.search}`);
    if (!response.ok) { location.href = "/setup"; return; }
    root.render(<><MonthlyPlanner {...await response.json()} /><button type="button" onClick={async () => { await fetch("/expire-trial", { method: "POST" }); location.reload(); }}>一時DBの体験を終了（検証専用）</button></>);
  }
}
window.addEventListener("first-week-refresh", () => { void render(); });
void render();
