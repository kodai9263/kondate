import type { Metadata } from "next";
import { ArrowRight, CalendarDays, Check, ChefHat, Clock3, MessageCircleQuestion, ShoppingBasket, Users } from "lucide-react";
import Link from "next/link";
import { TrackedLink } from "@/components/features/analytics/TrackedLink";
import { buttonClass } from "@/components/ui/Button";
import { getMonitorCampaignStatus } from "@/lib/marketing/monitorCampaign.server";

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

export default async function MonitorPage() {
  const monitorStatus = await getMonitorCampaignStatus();
  const accepting = monitorStatus.isAvailable && monitorStatus.isOpen;
  return (
    <main className="min-h-dvh bg-kondate-bg text-kondate-ink">
      <header className="border-b-2 border-kondate-ink bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="きょうのごはん トップ" className="flex min-h-11 items-center gap-2">
            <ChefHat size={20} className="text-kondate-accent" aria-hidden="true" />
            <span className="font-mincho text-lg font-bold">きょうのごはん</span>
          </Link>
          <span className="border-l-2 border-kondate-accent pl-3 text-xs font-black sm:text-sm">無料モニター募集</span>
        </div>
      </header>

      <section className="border-b-2 border-kondate-ink bg-white px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <p className="inline-flex min-h-11 items-center border-2 border-kondate-ink bg-kondate-morning px-4 text-sm font-black">{accepting ? `先着10家庭・残り${monitorStatus.remaining}家庭` : monitorStatus.isAvailable ? "10家庭に達したため受付終了" : "受付状況を確認できません"}</p>
            <h1 className="font-mincho mt-6 text-[38px] font-black leading-[1.25] sm:text-6xl">平日の夕飯を考える時間を、<br className="hidden sm:block" />週に一度へ。</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-kondate-muted sm:text-lg">「きょうのごはん」は、献立・仕込み・買い物を家族で進める献立Todoアプリです。もっと使いやすくするため、実際の暮らしの中で2週間試してくださるご家庭を募集します。</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {accepting ? <TrackedLink href="/signup?source=monitor" eventName="monitor_signup_click" eventParams={{ placement: "hero" }} className={buttonClass({ className: "px-7" })}>14日間の無料モニターに参加 <ArrowRight size={18} aria-hidden="true" /></TrackedLink> : <span className={buttonClass({ variant: "secondary", className: "cursor-not-allowed px-7 text-kondate-muted" })}>無料モニター受付終了</span>}
              <TrackedLink href="/demo/planner?source=monitor" eventName="monitor_demo_click" eventParams={{ placement: "hero" }} className={buttonClass({ variant: "secondary", className: "px-7" })}>登録前に献立を試す</TrackedLink>
            </div>
            <p className="mt-4 text-xs leading-6 text-kondate-faint">家族プランの全機能を14日間無料・カード登録不要・終了後の自動課金なし</p>
          </div>

          <aside className="border-2 border-kondate-ink bg-kondate-sage p-6 sm:p-8" aria-label="モニター概要">
            <p className="text-xs font-black text-[#285b35]">MONITOR DETAILS</p>
            <h2 className="font-mincho mt-2 text-2xl font-black">ご協力いただきたいこと</h2>
            <dl className="mt-6 space-y-4 border-t-2 border-kondate-ink pt-5 text-sm">
              <div className="grid grid-cols-[88px_1fr] gap-3"><dt className="font-black">対象</dt><dd className="text-kondate-muted">平日の夕飯を用意するご家庭</dd></div>
              <div className="grid grid-cols-[88px_1fr] gap-3"><dt className="font-black">期間</dt><dd className="text-kondate-muted">利用開始から約2週間</dd></div>
              <div className="grid grid-cols-[88px_1fr] gap-3"><dt className="font-black">費用</dt><dd className="text-kondate-muted">無料</dd></div>
              <div className="grid grid-cols-[88px_1fr] gap-3"><dt className="font-black">お願い</dt><dd className="text-kondate-muted">終了後の簡単なアンケート</dd></div>
            </dl>
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
          {accepting ? <TrackedLink href="/signup?source=monitor" eventName="monitor_signup_click" eventParams={{ placement: "footer" }} className={buttonClass({ variant: "secondary", className: "shrink-0 border-white bg-white px-7 text-kondate-ink hover:border-white hover:bg-kondate-bg" })}>14日間の無料モニターに参加 <ArrowRight size={18} aria-hidden="true" /></TrackedLink> : <span className={buttonClass({ variant: "secondary", className: "shrink-0 cursor-not-allowed border-white bg-white px-7 text-kondate-muted" })}>無料モニター受付終了</span>}
        </div>
      </section>

      <footer className="border-t-2 border-kondate-ink bg-white px-4 py-8 text-sm text-kondate-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="font-mincho text-base font-bold text-kondate-ink">きょうのごはん</p><div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/privacy">プライバシー</Link><Link href="/terms">利用規約</Link><Link href="/legal">特商法表記</Link></div></div>
      </footer>
    </main>
  );
}
