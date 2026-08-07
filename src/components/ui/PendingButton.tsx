"use client";

import { useFormStatus } from "react-dom";

export function PendingButton({ children, pendingLabel = "保存しています..." }: { children: React.ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-12 w-full rounded-lg bg-kondate-accent px-5 font-black text-white transition hover:bg-[#a93b18] disabled:cursor-wait disabled:bg-kondate-line disabled:text-kondate-muted">{pending ? pendingLabel : children}</button>;
}
