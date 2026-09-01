"use client";

import { useEffect } from "react";

export function ScrollToAccountTop({ saveId }: { saveId?: string }) {
  useEffect(() => {
    if (!saveId) return;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [saveId]);

  return null;
}
