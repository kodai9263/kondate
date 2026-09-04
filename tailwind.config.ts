import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kondate: {
          // 地と器
          bg: "#f6f7f4",
          surface: "#ffffff",
          // 文字は3段。ink=本文と見出し / muted=補助 / faint=単位と注記
          ink: "#20241f",
          muted: "#5f675f",
          faint: "#8b918a",
          line: "#e3e7e0",
          // 朱は「押せる場所」と「現在地」だけに使う
          accent: "#ca4b24",
          accentDark: "#a53c1a",
          accentSoft: "#fdf1ea",
          // 状態
          done: "#4a8f55",
          doneSoft: "#eff5ef",
          alert: "#a8352a",
          alertSoft: "#fbf2f1",
          // 時間帯。面ではなく左の細い罫だけに使う
          morningInk: "#9a7420",
          eveningInk: "#41638f",
          // LPと料金ページが使用中のため保持
          sage: "#e8f1e9",
          morning: "#fff5cf",
          evening: "#e9f0ff"
        }
      }
    }
  },
  plugins: []
};

export default config;
