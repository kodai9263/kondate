"use client";

import { useState } from "react";

const portalErrorMessages: Record<string, string> = {
  unauthenticated: "ログインしてからもう一度お試しください。",
  stripe_customer_not_found: "契約情報を確認できませんでした。サポートへお問い合わせください。",
  portal_failed: "契約管理画面を開けませんでした。時間をおいてもう一度お試しください。",
};

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(portalErrorMessages[payload.error ?? "portal_failed"] ?? portalErrorMessages.portal_failed);
      }
      window.location.assign(payload.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "portal_failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="min-h-11 w-full rounded-lg border border-kondate-line px-4 text-sm font-black text-kondate-muted"
        disabled={loading}
        onClick={openPortal}
      >
        {loading ? "管理画面を準備中" : "支払い・解約を管理"}
      </button>
      {error ? <p className="text-xs font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
