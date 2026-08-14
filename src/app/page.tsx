import { ArrowRight, Check, ChefHat, Clock3, ListChecks, ShoppingBasket, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { hasAuthenticatedSession } from "@/lib/auth/session";
import { menuData } from "@/lib/menuData";
import { findTodayPlan } from "@/lib/services/planService";

const features = [
  { number: "01", icon: Clock3, title: "今日だけ見れば、動ける", body: "朝の仕込みと夜の手順を、やる順番に。レシピを何度も読み返さなくて済みます。" },
  { number: "02", icon: ListChecks, title: "献立は、4週間まとめて", body: "家族向けに組んだローテーションから始めるので、毎日の献立会議がなくなります。" },
  { number: "03", icon: ShoppingBasket, title: "買うものまで、ひと続き", body: "定番献立の買い物目安を売り場ごとに確認。足りないものを追加し、その場でチェックできます。" },
];

export default async function LandingPage() {
  const isAuthenticated = await hasAuthenticatedSession();
  const today = findTodayPlan(menuData);
  const week = menuData.weeks[0];
  const primaryHref = isAuthenticated ? "/app" : "/signup";
  const primaryLabel = isAuthenticated ? "献立を開く" : "無料で始める";

  return (
    <main className="min-h-dvh bg-white">
      <header className="border-b-2 border-kondate-ink bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="きょうのごはん トップ" className="flex min-h-11 shrink-0 items-center gap-2 font-black">
            <span className="grid size-9 place-items-center bg-kondate-accent text-white"><ChefHat size={20} aria-hidden="true" /></span>
            <span className="hidden whitespace-nowrap sm:inline">きょうのごはん</span>
          </Link>
          <nav aria-label="メインナビゲーション" className="flex items-center gap-1 sm:gap-3">
            <Link href="/pricing" className="hidden min-h-11 items-center px-3 text-sm font-black text-kondate-muted sm:inline-flex">料金</Link>
            {!isAuthenticated ? <Link href="/login" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-sm font-black text-kondate-ink">ログイン</Link> : null}
            <Link href={primaryHref} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap bg-kondate-ink px-4 text-sm font-black text-white transition hover:bg-kondate-accent">{primaryLabel}</Link>
          </nav>
        </div>
      </header>

      <section className="relative h-[calc(100dvh-96px)] min-h-[560px] max-h-[760px] overflow-hidden border-b-2 border-kondate-ink">
        <Image src="/images/family-dinner.png" alt="鮭の塩焼き、具だくさん味噌汁、野菜のおかずが並ぶ家庭の食卓" fill loading="eager" sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-10 text-white sm:px-6 sm:pb-14">
          <div className="max-w-3xl border-l-4 border-[#ff6a3d] pl-4 sm:pl-6">
            <p className="text-sm font-black text-[#ffe7dc]">家族の献立Todo</p>
            <h1 className="font-mincho mt-2 text-[40px] font-black leading-none sm:text-7xl">きょうのごはん</h1>
            <p className="font-mincho mt-5 text-xl font-bold leading-9 sm:text-2xl">考えるのは、週に一度。<br className="sm:hidden" />あとは今日の段取りを見るだけ。</p>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:pl-7">
            <Link href={primaryHref} className="inline-flex min-h-12 items-center justify-center gap-2 bg-kondate-accent px-6 font-black text-white transition hover:bg-[#a93b18]">{isAuthenticated ? "献立の続きを開く" : "無料で使ってみる"} <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link href="/demo/planner" className="inline-flex min-h-12 items-center justify-center border-2 border-white bg-white/95 px-6 font-black text-kondate-ink">献立生成を試す</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-kondate-line bg-kondate-bg">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="border-2 border-kondate-ink bg-white" aria-label="アプリ画面のプレビュー">
            <div className="grid border-b-2 border-kondate-ink sm:grid-cols-[220px_1fr]">
              <div className="bg-kondate-ink p-5 text-white">
                <p className="text-xs font-black">TODAY</p>
                <p className="font-mincho mt-2 text-2xl font-black">{today.date}</p>
                <p className="mt-8 text-sm text-[#dce2dc]">5人分 / 夜 {today.dinner.cookMin}分</p>
              </div>
              <div className="grid sm:grid-cols-2">
                <div className="border-b border-kondate-ink bg-kondate-morning p-5 sm:border-b-0 sm:border-r"><p className="text-xs font-black text-[#765708]">朝の仕込み</p><p className="font-mincho mt-2 text-xl font-black">{today.dinner.dinner}</p><p className="mt-3 text-sm leading-6 text-kondate-muted">{today.dinner.morning[0]}</p></div>
                <div className="bg-kondate-evening p-5"><p className="text-xs font-black text-[#3155a4]">夜の手順</p><p className="font-mincho mt-2 text-xl font-black">{today.dinner.side}</p><p className="mt-3 text-sm leading-6 text-kondate-muted">{today.dinner.evening[0]}</p></div>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_320px]">
              <div className="p-5 sm:p-6 lg:border-r lg:border-kondate-ink">
                <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-black text-kondate-accent">WEEK 1</p><h2 className="font-mincho mt-1 text-xl font-black">今週の夕ごはん</h2></div><p className="text-xs font-bold text-kondate-muted">土曜にまとめ買い</p></div>
                <div className="grid grid-cols-2 border-l border-t border-kondate-line sm:grid-cols-4 lg:grid-cols-7">
                  {week.days.map((day) => <div key={day.dow} className="min-h-28 border-b border-r border-kondate-line p-3"><p className="text-xs font-black text-kondate-accent">{day.dow}</p><p className="mt-3 text-sm font-black leading-5">{day.dinner}</p><p className="mt-1 text-xs leading-5 text-kondate-muted">{day.side}</p></div>)}
                </div>
              </div>
              <div className="border-t border-kondate-ink bg-kondate-sage p-5 lg:border-t-0">
                <p className="flex items-center gap-2 text-xs font-black text-[#285b35]"><ShoppingBasket size={16} /> 買い物メモ</p>
                <ul className="mt-4 space-y-3">{week.shopping.肉.slice(0, 3).map((item) => <li key={item} className="flex gap-3 border-b border-[#bfd0c1] pb-3 text-sm font-bold"><span className="mt-0.5 size-4 shrink-0 border-2 border-[#285b35]" />{item}</li>)}</ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-kondate-ink bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-[260px_1fr]"><div><p className="text-sm font-black text-kondate-accent">毎日の段取り</p><h2 className="font-mincho mt-2 text-3xl font-black leading-tight">献立表で終わらせない。</h2></div><div className="border-t-2 border-kondate-ink">{features.map(({ number, icon: Icon, title, body }) => <article key={number} className="grid gap-3 border-b border-kondate-ink py-6 sm:grid-cols-[64px_1fr_1.3fr] sm:items-start"><p className="font-mincho text-2xl font-black text-kondate-accent">{number}</p><h3 className="flex items-center gap-2 text-lg font-black"><Icon size={20} aria-hidden="true" />{title}</h3><p className="text-sm leading-7 text-kondate-muted">{body}</p></article>)}</div></div>
        </div>
      </section>

      <section className="border-b-2 border-kondate-ink bg-kondate-sage px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 text-sm font-black text-[#285b35]"><Users size={18} aria-hidden="true" />家族プラン</div>
          <div className="mt-4 grid gap-8 border-t-2 border-kondate-ink pt-6 md:grid-cols-[1fr_auto] md:items-end">
            <div><h2 className="font-mincho text-3xl font-black leading-tight sm:text-4xl">「やった」が、家族みんなに伝わる。</h2><p className="mt-4 max-w-2xl leading-7 text-kondate-muted">買ったものも、終わった仕込みもリアルタイムで共有。ひとりに集中していたごはん管理を、家族の共同作業に変えます。</p><ul className="mt-6 flex flex-col gap-3 text-sm font-bold sm:flex-row sm:gap-6">{["献立・買い物共有", "チェック状態の同期", "季節テンプレート"].map(item => <li key={item} className="flex gap-2"><Check size={18} className="shrink-0 text-[#285b35]" />{item}</li>)}</ul></div>
            <div className="border-l-4 border-kondate-accent pl-5"><p className="text-sm font-black">家族みんなで</p><p className="mt-1 text-4xl font-black">月480円</p><Link href="/pricing" className="mt-5 inline-flex min-h-12 items-center gap-2 bg-kondate-ink px-6 font-black text-white">詳しく見る <ArrowRight size={18} /></Link></div>
          </div>
        </div>
      </section>

      <section className="bg-kondate-accent px-4 py-14 text-white sm:px-6"><div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mincho text-3xl font-black">次のごはんから、迷わない。</p><p className="mt-2 text-sm font-bold text-[#ffe4d8]">{isAuthenticated ? "保存した献立の続きから始められます。" : "カード登録なし。無料版から始められます。"}</p></div><Link href={primaryHref} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-white px-7 font-black text-kondate-ink">{primaryLabel} <ArrowRight size={18} /></Link></div></section>

      <footer className="border-t-2 border-kondate-ink bg-white px-4 py-8 text-sm text-kondate-muted"><div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="font-black text-kondate-ink">きょうのごはん</p><div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/pricing">料金</Link><Link href="/terms">利用規約</Link><Link href="/privacy">プライバシー</Link><Link href="/legal">特商法表記</Link></div></div></footer>
    </main>
  );
}
