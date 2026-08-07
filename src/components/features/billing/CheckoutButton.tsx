"use client";

import { useState } from "react";
import type { BillingPlanId } from "@/lib/billing/plans";

type CheckoutButtonProps = {
  planId: Exclude<BillingPlanId, "free">;
  children: React.ReactNode;
};

export function CheckoutButton({ planId, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "checkout_failed");
      }

      window.location.assign(payload.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "checkout_failed");
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        className="min-h-12 w-full rounded-lg bg-kondate-accent px-4 font-black text-white disabled:bg-kondate-line disabled:text-kondate-muted"
        disabled={loading}
        onClick={startCheckout}
      >
        {loading ? "Checkoutを準備中" : children}
      </button>
      {error ? <p className="text-xs font-bold text-red-700">ログインとStripe設定を確認してください: {error}</p> : null}
    </div>
  );
}
