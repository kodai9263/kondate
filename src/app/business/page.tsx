import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CarFront, ChefHat, Mail } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "運営サービス",
  description: "運営者が提供するソフトウェアサービスのご案内",
};

const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "運営者情報は特定商取引法に基づく表記をご確認ください";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

const services = [
  {
    name: "きょうのごはん",
    description: "献立、仕込み、買い物を家族で共有し、毎日の食事づくりを進める献立Todoアプリです。",
    href: "https://kondate-bay.vercel.app",
    icon: ChefHat,
  },
  {
    name: "Carpool",
    description: "少年野球やサッカーチームの車出し確認と乗車割り当てを整理する配車管理アプリです。",
    href: "https://carpool-navy.vercel.app",
    icon: CarFront,
  },
];

export default function BusinessPage() {
  return (
    <main className="min-h-dvh bg-white">
      <header className="border-b-2 border-kondate-ink">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-kondate-muted">
            <ArrowLeft size={18} aria-hidden="true" />
            きょうのごはんへ
          </Link>
        </div>
      </header>

      <section className="border-b-2 border-kondate-ink bg-kondate-bg px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black text-kondate-accent">運営情報</p>
          <h1 className="font-mincho mt-2 text-4xl font-black leading-tight sm:text-5xl">運営サービス</h1>
          <p className="mt-5 max-w-2xl leading-8 text-kondate-muted">
            家庭や地域の負担を減らす、日々の段取りに特化したソフトウェアを企画・開発・運営しています。
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl border-t-2 border-kondate-ink">
          {services.map(({ name, description, href, icon: Icon }) => (
            <article key={name} className="grid gap-5 border-b border-kondate-ink py-8 md:grid-cols-[220px_1fr_auto] md:items-center">
              <h2 className="flex items-center gap-3 text-xl font-black">
                <span className="grid size-10 shrink-0 place-items-center bg-kondate-ink text-white">
                  <Icon size={20} aria-hidden="true" />
                </span>
                {name}
              </h2>
              <p className="text-sm leading-7 text-kondate-muted">{description}</p>
              <a href={href} className="inline-flex min-h-11 items-center gap-2 font-black text-kondate-accent">
                サービスを見る <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-kondate-line bg-kondate-sage px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-black text-[#285b35]">運営者</h2>
            <p className="mt-2 font-black">{operatorName}</p>
            <Link href="/legal" className="mt-3 inline-flex min-h-11 items-center text-sm font-black underline underline-offset-4">
              特定商取引法に基づく表記
            </Link>
          </div>
          <div>
            <h2 className="text-sm font-black text-[#285b35]">お問い合わせ</h2>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="mt-2 inline-flex min-h-11 items-center gap-2 font-black underline underline-offset-4">
                <Mail size={18} aria-hidden="true" />
                {supportEmail}
              </a>
            ) : (
              <p className="mt-2 text-sm text-kondate-muted">特定商取引法に基づく表記をご確認ください。</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
