import type { ButtonHTMLAttributes } from "react";

// ボタンの見た目を1箇所に集約する。
// ボタン見た目の <Link> が多いので、スタイルは純粋関数として export し、
// このファイル自体は "use client" を不要にしている。

export type ButtonVariant = "primary" | "ink" | "secondary" | "danger";
export type ButtonSize = "md" | "sm" | "icon";

const base = [
  "inline-flex items-center justify-center gap-2",
  // 角8px。カード(4px)と差をつけて「押せるもの」を見分けられるようにする
  "rounded-lg font-semibold",
  "transition-all duration-150",
  // 押すと1px沈む
  "active:translate-y-px",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondate-ink focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-40",
].join(" ");

const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-5 text-[15px]",
  sm: "min-h-9 px-3 text-xs",
  icon: "size-11 shrink-0 px-0",
};

const variants: Record<ButtonVariant, string> = {
  // 主操作。紙から微かに浮かせ、押すと影が消えて沈む
  primary: "bg-kondate-accent text-white shadow-[0_1px_2px_rgba(32,36,31,0.08)] hover:bg-kondate-accentDark hover:shadow-[0_2px_5px_rgba(32,36,31,0.12)] active:shadow-none disabled:bg-kondate-line disabled:text-kondate-muted disabled:shadow-none",
  // 墨の主操作
  ink: "bg-kondate-ink text-white shadow-[0_1px_2px_rgba(32,36,31,0.08)] hover:bg-kondate-accent hover:shadow-[0_2px_5px_rgba(32,36,31,0.12)] active:shadow-none disabled:bg-kondate-line disabled:text-kondate-muted disabled:shadow-none",
  // 副操作。白地に細罫、hoverで罫と文字が墨に寄る
  secondary: "border border-kondate-line bg-white text-kondate-muted hover:border-kondate-ink hover:text-kondate-ink",
  // 削除など。普段は沈ませ、hoverで初めて赤みが出る
  danger: "text-kondate-faint hover:bg-kondate-alertSoft hover:text-kondate-alert",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return [base, sizes[size], variants[variant], fullWidth ? "w-full" : "", className].filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function Button({ variant, size, fullWidth, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, fullWidth, className })} {...props} />;
}
