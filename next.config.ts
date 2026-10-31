import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
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
