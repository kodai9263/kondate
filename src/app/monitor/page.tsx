import type { Metadata } from "next";
import { ArrowRight, CalendarDays, Check, ChefHat, Clock3, ListChecks, MessageCircleQuestion, ShoppingBasket, Users } from "lucide-react";
import Link from "next/link";
import { TrackedLink } from "@/components/features/analytics/TrackedLink";
import { buttonClass } from "@/components/ui/Button";
import { buildMonitorSignupHref } from "@/lib/marketing/campaignParams";
import { getMonitorCampaignStatus } from "@/lib/marketing/monitorCampaign.server";
import { menuData } from "@/lib/menuData";
import { findTodayPlan } from "@/lib/services/planService";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "無料モニター募集",
  description: "平日の夕飯決めを楽にする献立Todoアプリ「きょうのごはん」の無料モニターを10家庭募集します。",
};

const benefits = [
  { icon: CalendarDays, title: "4週間の献立をまとめて", body: "家族向けの定番メニューから、毎日の夕飯を先に決められます。" },
  { icon: Clock3, title: "今日は段取りだけ確認", body: "朝の仕込みと夜の手順を、動く順番に確認できます。" },
  { icon: ShoppingBasket, title: "買い物までひと続き", body: "必要なものを売り場ごとに見て、家族とチェック状況を共有できます。" },
];

const steps = [
  { number: "01", title: "無料アカウントを作る", body: "カード登録は不要です。最初に家族の人数などを設定します。" },
  { number: "02", title: "2週間、普段の夕飯で使う", body: "献立、今日の段取り、買い物リストを無理のない範囲で試してください。" },
  { number: "03", title: "5分ほどの感想を伝える", body: "続けたい点、迷った点、使わなかった理由も率直に教えてください。" },
];

const faqs = [
  { question: "本当に無料ですか？", answer: "14日間、月480円の家族プランと同じ機能を無料で使えます。カード登録は不要です。終了後は自動課金されず、データを残したまま無料プランへ戻ります。" },
  { question: "毎日使う必要がありますか？", answer: "ありません。普段の生活の中で、使いたい日にお試しください。使わなかった日や理由も大切なご意見です。" },
  { question: "料理が得意でなくても参加できますか？", answer: "参加できます。特別な材料を使わない、名前を見れば分かる家庭の定番メニューを中心にしています。" },
];

export default async function MonitorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const campaignParams = await searchParams;
  const monitorStatus = await getMonitorCampaignStatus();
  const accepting = monitorStatus.isAvailable && monitorStatus.isOpen;
  const signupHref = buildMonitorSignupHref(campaignParams);
  const today = findTodayPlan(menuData);
  const previewDays = menuData.weeks[0].days.slice(0, 3);
  return (
    <main className="min-h-dvh bg-kondate-bg pb-28 text-kondate-ink md:pb-0">
      <header className="border-b-2 border-kondate-ink bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="きょうのごはん トップ" className="flex min-h-11 items-center gap-2">
            <ChefHat size={20} className="text-kondate-accent" aria-hidden="true" />
            <span className="font-mincho text-lg font-bold">きょうのごはん</span>
          </Link>
          <span className="border-l-2 border-kondate-accent pl-3 text-xs font-black sm:text-sm">無料モニター募集</span>
        </div>
      </header>

      <section className="border-b-2 border-kondate-ink bg-white px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-center">
          <div>
            <p className="inline-flex min-h-11 items-center border-2 border-kondate-ink bg-kondate-morning px-4 text-sm font-black">{accepting ? `先着10家庭・残り${monitorStatus.remaining}家庭` : monitorStatus.isAvailable ? "10家庭に達したため受付終了" : "受付状況を確認できません"}</p>
            <h1 className="font-mincho mt-6 text-[34px] font-black leading-[1.3] sm:text-5xl">「何作ろう？」を、<br />週1回だけに。</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-kondate-muted sm:text-lg">4週間の献立、今日の段取り、買い物リストまでひとまとめ。開発中のため、10家庭限定で14日間無料で試せます。</p>
            <ul className="mt-6 grid gap-2 text-sm font-bold sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {["入力は3項目", "カード登録不要", "自動課金なし"].map((item) => <li key={item} className="flex items-center gap-2"><Check size={17} className="shrink-0 text-kondate-accent" aria-hidden="true" />{item}</li>)}
            </ul>
            <div className="mt-8">
              {accepting ? <TrackedLink href={signupHref} eventName="monitor_signup_click" eventParams={{ placement: "hero" }} className={buttonClass({ className: "w-full px-7 sm:w-auto" })}>無料で14日間試す <ArrowRight size={18} aria-hidden="true" /></TrackedLink> : <span className={buttonClass({ variant: "secondary", className: "w-full cursor-not-allowed px-7 text-kondate-muted sm:w-auto" })}>無料モニター受付終了</span>}
            </div>
            <p className="mt-4 text-xs leading-6 text-kondate-faint">登録は約1分。お願いするのは、使ったあとの5分ほどの感想だけです。</p>
          </div>

          <aside className="border-2 border-kondate-ink bg-kondate-bg" aria-label="アプリ画面のプレビュー">
            <div className="grid border-b-2 border-kondate-ink sm:grid-cols-[140px_1fr]">
              <div className="bg-kondate-ink p-5 text-white"><p className="text-xs font-black">TODAY</p><p className="font-mincho mt-2 text-xl font-black">{today.date}</p><p className="mt-6 text-xs text-[#dce2dc]">夜 {today.dinner.cookMin}分</p></div>
              <div className="grid grid-cols-2">
                <div className="border-r border-kondate-ink bg-kondate-morning p-4"><p className="text-xs font-black text-[#765708]">朝の仕込み</p><p className="mt-2 text-sm font-black leading-6">{today.dinner.dinner}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-kondate-muted">{today.dinner.morning[0]}</p></div>
                <div className="bg-kondate-evening p-4"><p className="text-xs font-black text-[#3155a4]">夜の手順</p><p className="mt-2 text-sm font-black leading-6">{today.dinner.side}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-kondate-muted">{today.dinner.evening[0]}</p></div>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-kondate-accent">WEEK 1</p><p className="font-mincho mt-1 text-lg font-black">今週の夕ごはん</p></div><ListChecks size={22} className="text-kondate-accent" aria-hidden="true" /></div>
              <div className="mt-4 grid grid-cols-3 border-l border-t border-kondate-line">
                {previewDays.map((day) => <div key={day.dow} className="min-h-28 border-b border-r border-kondate-line bg-white p-3"><p className="text-xs font-black text-kondate-accent">{day.dow}</p><p className="mt-2 text-xs font-black leading-5 sm:text-sm">{day.dinner}</p><p className="mt-1 text-[11px] leading-4 text-kondate-muted">{day.side}</p></div>)}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b-2 border-kondate-ink px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black text-kondate-accent">こんなご家庭へ</p>
          <h2 className="font-mincho mt-2 text-3xl font-black">ひとつでも当てはまれば、ぜひお試しください。</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {["夕方になってから献立を考えている", "買い物や仕込みがひとりに偏っている", "家族に好評だった料理を覚えておきたい"].map((item) => (
              <li key={item} className="flex gap-3 border border-kondate-line bg-white p-5 text-sm font-bold leading-7"><Check size={20} className="mt-1 shrink-0 text-kondate-accent" aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b-2 border-kondate-ink bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black text-kondate-accent">できること</p>
          <h2 className="font-mincho mt-2 text-3xl font-black">献立表で終わらず、今日の行動まで。</h2>
          <div className="mt-8 grid border-l border-t border-kondate-ink md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, body }) => (
              <article key={title} className="border-b border-r border-kondate-ink p-6 sm:p-8">
                <Icon size={24} className="text-kondate-accent" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-kondate-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-kondate-ink bg-kondate-morning px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 text-sm font-black text-[#765708]"><Users size={20} aria-hidden="true" />参加の流れ</div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {steps.map(({ number, title, body }) => (
              <article key={number} className="border-2 border-kondate-ink bg-white p-6">
                <p className="font-mincho text-3xl font-black text-kondate-accent">{number}</p>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-kondate-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-kondate-ink bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-black text-kondate-accent"><MessageCircleQuestion size={20} aria-hidden="true" />よくある質問</div>
          <div className="mt-6 border-t-2 border-kondate-ink">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="group border-b border-kondate-ink py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-black marker:content-none">{question}<span className="text-xl text-kondate-accent group-open:rotate-45" aria-hidden="true">＋</span></summary>
                <p className="mt-2 pr-8 text-sm leading-7 text-kondate-muted">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-kondate-accent px-4 py-14 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-mincho text-3xl font-black">次のごはんから、試してみませんか。</p><p className="mt-2 text-sm font-bold text-[#ffe4d8]">率直な感想が、これからの「きょうのごはん」をつくります。</p></div>
          {accepting ? <TrackedLink href={signupHref} eventName="monitor_signup_click" eventParams={{ placement: "footer" }} className={buttonClass({ variant: "secondary", className: "shrink-0 border-white bg-white px-7 text-kondate-ink hover:border-white hover:bg-kondate-bg" })}>無料で14日間試す <ArrowRight size={18} aria-hidden="true" /></TrackedLink> : <span className={buttonClass({ variant: "secondary", className: "shrink-0 cursor-not-allowed border-white bg-white px-7 text-kondate-muted" })}>無料モニター受付終了</span>}
        </div>
      </section>

      <footer className="border-t-2 border-kondate-ink bg-white px-4 py-8 text-sm text-kondate-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="font-mincho text-base font-bold text-kondate-ink">きょうのごはん</p><div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/privacy">プライバシー</Link><Link href="/terms">利用規約</Link><Link href="/legal">特商法表記</Link></div></div>
      </footer>

      {accepting ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-kondate-ink bg-white px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_18px_rgba(32,36,31,0.12)] md:hidden">
          <p className="mb-2 text-center text-xs font-bold text-kondate-muted">カード不要・自動課金なし</p>
          <TrackedLink href={signupHref} eventName="monitor_signup_click" eventParams={{ placement: "mobile_sticky" }} className={buttonClass({ fullWidth: true, className: "touch-manipulation" })}>無料で14日間試す <ArrowRight size={18} aria-hidden="true" /></TrackedLink>
        </div>
      ) : null}
    </main>
  );
}
