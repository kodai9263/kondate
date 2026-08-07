"use client";

import { Check } from "lucide-react";
import { useState } from "react";

type CheckRowProps = {
  children: React.ReactNode;
  defaultChecked?: boolean;
};

export function CheckRow({ children, defaultChecked = false }: CheckRowProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      type="button"
      aria-pressed={checked}
      className="grid min-h-11 w-full grid-cols-[28px_1fr] items-center gap-3 rounded-lg px-1 py-2 text-left transition active:scale-[0.99]"
      onClick={() => setChecked((current) => !current)}
    >
      <span
        className={[
          "flex size-7 items-center justify-center rounded-full border-2 transition",
          checked ? "border-[#4f9f58] bg-[#4f9f58] text-white" : "border-[#d9cfc4] bg-white text-transparent",
        ].join(" ")}
      >
        <Check size={16} strokeWidth={3} />
      </span>
      <span className={checked ? "text-kondate-muted line-through" : ""}>{children}</span>
    </button>
  );
}
