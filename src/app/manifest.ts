import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "きょうのごはん",
    short_name: "きょうのごはん",
    description: "献立、仕込み、買い物を家族で進める献立Todoアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf0",
    theme_color: "#c94028",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
