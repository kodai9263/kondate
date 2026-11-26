import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/.well-known/apple-app-site-association",
      headers: [
        { key: "Content-Type", value: "application/json" },
        { key: "Cache-Control", value: "public, max-age=3600" },
      ],
    }, {
      source: "/admin/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        // 承諾記録を外部スクリプト・埋め込み・解析サービスに渡さない。
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
      ],
    }];
  },
  // モバイル専用依存を持つテストは、Web配布とは別に型チェックする。
  typescript: { tsconfigPath: "tsconfig.web.json" },
  experimental: {
    // 動的ページも短時間だけクライアント側に保持し、再訪時の初期表示を速くする
    staleTimes: {
      dynamic: 120,
    },
  },
};

export default nextConfig;
