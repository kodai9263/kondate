"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  helper,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  helper?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} <span className="text-xs font-normal text-kondate-faint">（必須）</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        minLength={type === "password" ? 8 : undefined}
        autoComplete={autoComplete}
        aria-describedby={helper ? `${id}-helper` : undefined}
        // 角はボタンと揃えて8px。フォーカスは朱の枠と薄いリングで確実に見えるようにする
        className="min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3.5 text-base text-kondate-ink outline-none transition-colors focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accent/15"
      />
      {helper ? (
        <p id={`${id}-helper`} className="mt-1.5 text-xs leading-6 text-kondate-faint">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function AuthSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} fullWidth className="disabled:cursor-wait">
      {pending ? "処理しています..." : children}
    </Button>
  );
}
