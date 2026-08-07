"use client";

import { Check } from "lucide-react";

type CheckRowProps = {
  children: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function CheckRow({ children, checked, disabled = false, onCheckedChange }: CheckRowProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      className="grid min-h-11 w-full grid-cols-[28px_1fr] items-center gap-3 rounded-lg px-1 py-2 text-left transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={[
          "flex size-7 items-center justify-center rounded-full border-2 transition",
          checked ? "border-[#4f9f58] bg-[#4f9f58] text-white" : "border-[#d9cfc4] bg-white text-transparent",
        ].join(" ")}
      >
        <Check size={16} strokeWidth={3} aria-hidden="true" />
      </span>
      <span className={checked ? "text-kondate-muted line-through" : ""}>{children}</span>
    </button>
  );
}
