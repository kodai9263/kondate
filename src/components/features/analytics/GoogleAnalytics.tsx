"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { normalizeGoogleAnalyticsId } from "@/lib/analytics/googleAnalytics";

export function GoogleAnalytics() {
  const measurementId = normalizeGoogleAnalyticsId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const pathname = usePathname();
  if (!measurementId || pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)}, { anonymize_ip: true });`}
      </Script>
    </>
  );
}
