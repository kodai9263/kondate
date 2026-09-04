"use client";

import { CalendarRange, Home, Library, ShoppingCart, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "今日", icon: Home },
  { href: "/app/planner", label: "月間献立", icon: CalendarRange },
  { href: "/app/shopping", label: "買い物", icon: ShoppingCart },
  { href: "/app/recipes", label: "メニュー", icon: Library },
  { href: "/account", label: "設定", icon: UserRound },
] as const;

export function AppBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-kondate-line bg-white px-2 pb-[max(10px,env(safe-area-inset-bottom))]" aria-label="アプリナビゲーション">
      <div className="mx-auto grid max-w-[640px] grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "-mt-px flex min-h-12 flex-col items-center justify-center gap-1 border-t-2 pt-1 text-[11px] transition-colors",
                active ? "border-kondate-accent font-semibold text-kondate-accent" : "border-transparent text-kondate-muted",
              ].join(" ")}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
