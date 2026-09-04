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
      className="grid min-h-12 w-full grid-cols-[26px_1fr] items-start gap-3 py-2.5 text-left transition-colors hover:bg-kondate-bg disabled:cursor-wait disabled:opacity-50"
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={[
          "mt-0.5 flex size-[26px] items-center justify-center rounded-full border transition-colors",
          checked ? "border-kondate-done bg-kondate-done text-white" : "border-kondate-line bg-white text-transparent",
        ].join(" ")}
      >
        <Check size={15} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className={["text-[15px] leading-7", checked ? "text-kondate-faint line-through" : "text-kondate-ink"].join(" ")}>
        {children}
      </span>
    </button>
  );
}
