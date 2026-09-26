import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && !env.VITE_API_BASE_URL?.startsWith("https://")) {
    throw new Error("端末向けビルドにはHTTPSのVITE_API_BASE_URLが必要です");
  }
  return {
    server: {
      port: 5173,
      proxy: { "/api": "http://localhost:3000" },
    },
  };
});
