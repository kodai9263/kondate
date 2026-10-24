import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TodaySteps, ReminderEditor } from "./ContentSections";
function Preview() {
 const [value, setValue] = useState({ enabled: true, weekday: 6, time: "07:20" });
 return <div className="app-shell"><main><header className="page-heading"><span className="section-tag">表示検証用・サンプルデータ</span><h1>お知らせ</h1></header>
 <ReminderEditor title="仕込み" description="今日の段取りを確認する時間" value={value} onChange={setValue} />
 <section className="account-card"><h2>家族の人数</h2><p>献立と買い物の分量計算に使います。</p><div className="family-size-fields"><label>大人<input type="number" defaultValue={2} /></label><label>子ども<input type="number" defaultValue={2} /></label></div></section>
 <section className="today-card" style={{marginTop: 24}}><h2>クリームシチュー</h2><TodaySteps title="作ること" steps={["玉ねぎは薄めのくし切り、にんじんとじゃがいもは小さめの一口大に切る。", "野菜が柔らかくなり、鶏肉の中心まで十分に火が通ったことを確かめる。", "ルウの種類によって必要な水・牛乳の量が違うため、別の商品を使うときは箱の4皿分の表示に合わせる。", "参考：https://www.sbfoods.co.jp/recipe/detail/04851.html"]} /></section>
 </main></div>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
