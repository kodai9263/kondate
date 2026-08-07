"use client";

import { useFormStatus } from "react-dom";

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
      <label htmlFor={id} className="mb-2 block text-sm font-black">
        {label} <span className="text-xs text-kondate-muted">（必須）</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        minLength={type === "password" ? 8 : undefined}
        autoComplete={autoComplete}
        aria-describedby={helper ? `${id}-helper` : undefined}
        className="min-h-12 w-full border-2 border-kondate-ink bg-white px-3 text-base text-kondate-ink outline-none transition focus:border-kondate-accent focus:ring-2 focus:ring-kondate-accentSoft"
      />
      {helper ? (
        <p id={`${id}-helper`} className="mt-1.5 text-xs leading-5 text-kondate-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function AuthSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full cursor-pointer bg-kondate-accent px-4 font-black text-white transition hover:bg-[#b83f0b] disabled:cursor-wait disabled:bg-kondate-line disabled:text-kondate-muted"
    >
      {pending ? "処理しています..." : children}
    </button>
  );
}
