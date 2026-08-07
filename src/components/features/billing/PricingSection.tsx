import { Check, Crown } from "lucide-react";
import { billingPlans } from "@/lib/billing/plans";
import { CheckoutButton } from "@/components/features/billing/CheckoutButton";
import { PortalButton } from "@/components/features/billing/PortalButton";
import Link from "next/link";

export function PricingSection({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-kondate-line bg-kondate-surface p-4 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-black text-kondate-accent">
          <Crown size={17} />
          家族に合うプラン
        </p>
        <h1 className="mt-2 text-2xl font-black leading-tight">夕飯の迷いと買い物メモ作成を、家族でなくす。</h1>
        <p className="mt-2 text-sm leading-6 text-kondate-muted">
          無料で試して、家族共有が必要になったら家族プランへ。1契約で家族全員が利用できます。
        </p>
      </div>

      <div className="grid gap-3">
        {billingPlans.map((plan) => (
          <article
            key={plan.id}
            className={[
              "rounded-lg border bg-kondate-surface p-4",
              plan.highlighted ? "border-kondate-accent shadow-soft" : "border-kondate-line",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{plan.name}</h2>
                <p className="mt-1 text-sm text-kondate-muted">{plan.description}</p>
              </div>
              <p className="shrink-0 text-right text-xl font-black text-kondate-accent">{plan.priceLabel}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check size={17} className="mt-0.5 shrink-0 text-[#4f9f58]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {plan.id !== "free" && isAuthenticated ? (
              <CheckoutButton planId={plan.id}>{plan.id === "family_yearly" ? "年払いで始める" : "月払いで始める"}</CheckoutButton>
            ) : (
              <Link href={isAuthenticated ? "/app" : "/signup"} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg border border-kondate-line px-4 font-black text-kondate-muted">
                {plan.id === "free" ? "無料で使い始める" : "ログインして申し込む"}
              </Link>
            )}
          </article>
        ))}
      </div>

      {isAuthenticated ? <div className="rounded-lg border border-kondate-line bg-kondate-surface p-4">
        <h2 className="mb-2 text-base font-black">すでに契約している方</h2>
        <PortalButton />
      </div> : null}
    </section>
  );
}
