"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PlannerDialog({ labelId, onClose, children }: { labelId: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-labelledby={labelId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (event.target === event.currentTarget) onClose();
  }} className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-xl border border-kondate-line bg-white p-0 text-kondate-ink shadow-xl backdrop:bg-kondate-ink/55">
    <div className="flex max-h-[88dvh] flex-col">{children}</div>
  </dialog>;
}
