import { ArrowRight, Check, ChefHat } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { hasAuthenticatedSession } from "@/lib/auth/session";
import { menuData } from "@/lib/menuData";
import { findTodayPlan } from "@/lib/services/planService";

const features = [
  { title: "4週間分の献立", body: "用意された献立をもとに、家族の好みに合わせて変更できます。毎日、一から考える手間を減らせます。" },
  { title: "今日の手順を確認", body: "朝に準備することと、夜に作る手順をまとめています。終わったところにチェックを入れながら進められます。" },
  { title: "買うものをリストに", body: "食材を売り場ごとに確認できます。足りないものは追加して、買ったものにはその場でチェック。" },
];

export default async function LandingPage() {
  const isAuthenticated = await hasAuthenticatedSession();
  const today = findTodayPlan(menuData);
  const week = menuData.weeks[0];
  const shoppingExamples = [
    { label: "肉・魚", items: [...week.shopping.肉.slice(0, 2), ...week.shopping.魚.slice(0, 1)] },
    { label: "野菜・果物", items: week.shopping["野菜・果物"].slice(0, 2) },
  ];
  const primaryHref = isAuthenticated ? "/app" : "/signup";
  const primaryLabel = isAuthenticated ? "献立を開く" : "無料で始める";

  return (
    <main className="min-h-dvh bg-[#faf9f6] text-kondate-ink">
      <header className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="きょうのごはん トップ" className="inline-flex min-h-11 shrink-0 items-center gap-2">
          <ChefHat size={20} strokeWidth={1.5} className="text-kondate-accent" aria-hidden="true" />
          <span className="font-mincho text-base font-bold sm:text-lg">きょうのごはん</span>
        </Link>
        <nav aria-label="メインナビゲーション" className="flex items-center gap-3 text-sm sm:gap-6">
          <Link href="/pricing" className="inline-flex min-h-11 items-center text-kondate-muted hover:text-kondate-ink">料金</Link>
          <Link href={isAuthenticated ? "/app" : "/login"} className="inline-flex min-h-11 items-center hover:underline underline-offset-4">
            {isAuthenticated ? "献立を開く" : "ログイン"}
          </Link>
          {!isAuthenticated ? <Link href={primaryHref} className={buttonClass({ className: "hidden sm:inline-flex" })}>無料で始める</Link> : null}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-9 px-5 pb-12 pt-6 sm:px-8 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-12 lg:pb-20 lg:pt-12">
        <div>
          <p className="text-sm font-semibold text-kondate-ink">献立と買い物リストで、食費を見直す。</p>
          <h1 className="font-mincho mt-5 text-[44px] font-bold !leading-[1.2] sm:text-[64px] xl:text-[72px]">
            買いすぎを、<br /><span className="text-kondate-accent">減らそう。</span>
          </h1>
          <p className="mt-6 text-base leading-8 text-kondate-muted">
            献立を決めて、買うものをリストに。<br />
            「念のため」の買い足しを減らす。<br />
            節約は、いつもの買い物から。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 border-kondate-accent pl-4">
            <p className="text-sm leading-6">家族みんなで<br /><span className="text-kondate-muted">家族プラン</span></p>
            <p className="flex items-baseline gap-1"><span className="text-sm">月</span><span className="text-[38px] font-semibold leading-none tabular-nums">480</span><span className="text-sm">円</span></p>
            <span className="text-xs text-kondate-muted">ひとりで試せる無料版も</span>
          </div>
          <div className="mt-7">
            <Link href={primaryHref} className={buttonClass({ className: "min-h-14 w-full justify-between px-6 sm:w-64" })}>{primaryLabel}<ArrowRight size={18} aria-hidden="true" /></Link>
            <p className="mt-2 text-xs leading-6 text-kondate-muted">{isAuthenticated ? "保存した献立の続きから使えます。" : "カード登録不要。まずは無料版で試せます。"}</p>
            <Link href="/demo/planner" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm underline decoration-kondate-line underline-offset-8 hover:decoration-kondate-muted">登録せずに献立生成を試す<ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden lg:aspect-[4/5]">
          <Image
            src="/images/family-dinner.png"
            alt="鮭の塩焼き、具だくさん味噌汁、野菜のおかずが並ぶ家庭の食卓"
            fill
            loading="eager"
            sizes="(min-width: 1024px) 540px, (min-width: 640px) 90vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="border-y border-[#e6e2d9] bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-sm text-kondate-muted">「何を買うんだっけ？」を減らす。</p>
            <h2 className="font-mincho mt-4 text-2xl font-medium sm:text-3xl">買い物には、<br />このリストを持って。</h2>
            <p className="mt-5 max-w-md text-base leading-8 text-kondate-muted">売り場ごとに食材を確認して、買ったらチェック。必要なものを見ながら選べるので、買いすぎを防ぎやすくなります。</p>
            <div className="mt-8 space-y-7">
              {features.map(({ title, body }) => (
                <div key={title}>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-7 text-kondate-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="w-full" aria-label="買い物リストの表示例">
              <div className="border border-[#e6e2d9] bg-white px-6 py-7 sm:px-8">
                <div className="flex items-baseline justify-between gap-3 border-b border-kondate-line pb-5">
                  <h3 className="font-mincho text-xl">買い物リスト</h3>
                  <span className="text-xs text-kondate-muted">ある週の買うもの</span>
                </div>
                {shoppingExamples.map(({ label, items }) => (
                  <div key={label} className="mt-5">
                    <p className="text-xs text-kondate-muted">{label}</p>
                    <ul className="mt-1">
                      {items.map((item) => (
                        <li key={item} className="flex items-start gap-3 border-b border-kondate-line py-3 text-[15px] leading-7">
                          <span className="mt-1.5 size-4 shrink-0 rounded-sm border border-kondate-faint" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="mt-6 flex items-center gap-2 text-xs text-kondate-muted"><Check size={14} aria-hidden="true" />買ったものからチェック</p>
              </div>
              <p className="mt-3 text-right text-xs text-kondate-muted">買い物リストの一部を使った表示例です</p>
            </div>
            <div className="mt-8 border-l-2 border-kondate-line pl-5">
              <p className="text-xs text-kondate-muted">料理の手順の一例</p>
              <h3 className="font-mincho mt-2 text-xl">{today.dinner.dinner}</h3>
              <dl className="mt-4 space-y-4 text-sm leading-7">
                <div><dt className="font-semibold">朝の仕込み</dt><dd className="mt-1 text-kondate-muted">{today.dinner.morning[0]}</dd></div>
                <div><dt className="font-semibold">夜の手順</dt><dd className="mt-1 text-kondate-muted">{today.dinner.evening[0]}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-9 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-[1fr_300px] md:items-center md:gap-16">
        <div>
          <p className="text-sm text-kondate-muted">家族プラン</p>
          <h2 className="font-mincho mt-4 text-2xl font-medium sm:text-3xl">月480円分のムダ買いが<br />減れば、利用料の分に。</h2>
          <p className="mt-5 max-w-xl leading-8 text-kondate-muted">買い物リストも、料理の進み具合も家族で共有。「これ、もう買った？」の確認も、アプリで済ませられます。</p>
          <p className="mt-2 text-xs leading-6 text-kondate-muted">節約効果を保証するものではありません。</p>
        </div>
        <div className="border border-[#e6e2d9] bg-white p-7 sm:p-8">
          <p className="text-sm text-kondate-muted">家族みんなで</p>
          <p className="mt-2 flex items-baseline gap-1"><span className="text-sm">月</span><span className="text-5xl font-medium tabular-nums">480</span><span className="text-sm">円</span></p>
          <p className="mt-2 text-xs text-kondate-muted">1契約で、家族みんなが使えます。</p>
          <ul className="mt-5 space-y-2 text-sm text-kondate-muted">
            {["献立・買い物共有", "チェック状態の同期", "わが家のメニュー登録"].map((item) => <li key={item} className="flex items-center gap-2"><Check size={14} aria-hidden="true" />{item}</li>)}
          </ul>
          <Link href="/pricing" className={buttonClass({ variant: "ink", fullWidth: true, className: "mt-6" })}>家族プランを見る<ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
        <div className="flex flex-col gap-6 border-t border-[#e6e2d9] pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-mincho text-2xl">次の買い物から、使ってみませんか。</p><p className="mt-2 text-sm text-kondate-muted">{isAuthenticated ? "保存した献立の続きから始められます。" : "カード登録なし。無料版から始められます。"}</p></div>
          <Link href={primaryHref} className={buttonClass({ className: "self-start px-7 sm:shrink-0 sm:self-auto" })}>{primaryLabel}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="border-t border-[#e6e2d9] px-5 py-7 text-xs text-kondate-muted sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mincho text-sm text-kondate-ink">きょうのごはん</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link className="inline-flex min-h-11 items-center hover:underline" href="/pricing">料金</Link>
            <Link className="inline-flex min-h-11 items-center hover:underline" href="/business">運営サービス</Link>
            <Link className="inline-flex min-h-11 items-center hover:underline" href="/terms">利用規約</Link>
            <Link className="inline-flex min-h-11 items-center hover:underline" href="/privacy">プライバシー</Link>
            <Link className="inline-flex min-h-11 items-center hover:underline" href="/legal">特商法表記</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
