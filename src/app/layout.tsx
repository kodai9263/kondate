import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/features/analytics/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "きょうのごはん", template: "%s | きょうのごはん" },
  description: "献立、仕込み、買い物を家族で進める献立Todoアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c94028",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
