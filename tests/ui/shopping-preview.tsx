import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShoppingPageView, type ShoppingPageData } from "@/components/features/shopping/ShoppingPageView";

function Preview() {
  const [data, setData] = useState<ShoppingPageData | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(() => {
    fetch("/state").then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then((next) => { setData(next); setError(false); }).catch(() => setError(true));
  }, []);
  useEffect(() => { refresh(); window.addEventListener("shopping-refresh", refresh); return () => window.removeEventListener("shopping-refresh", refresh); }, [refresh]);
  return error ? <p role="alert">読み込みに失敗しました。</p> : data ? <ShoppingPageView {...data} /> : <p>読み込み中…</p>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
