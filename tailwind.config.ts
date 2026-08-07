import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kondate: {
          bg: "#f6f7f4",
          surface: "#ffffff",
          ink: "#20241f",
          muted: "#5f675f",
          line: "#dfe4dc",
          accent: "#ca4b24",
          accentSoft: "#fff0e8",
          sage: "#e8f1e9",
          morning: "#fff5cf",
          evening: "#e9f0ff"
        }
      },
      boxShadow: {
        soft: "0 12px 30px rgb(32 36 31 / 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
