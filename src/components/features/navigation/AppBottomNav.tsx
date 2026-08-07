"use client";

import { CalendarRange, Home, Library, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "今日", icon: Home },
  { href: "/app/planner", label: "月間献立", icon: CalendarRange },
  { href: "/app/recipes", label: "メニュー", icon: Library },
  { href: "/account", label: "設定", icon: UserRound },
] as const;

export function AppBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-kondate-line bg-white/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur" aria-label="アプリナビゲーション">
      <div className="mx-auto grid max-w-[640px] grid-cols-4 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={["flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs font-black transition", active ? "bg-kondate-accentSoft text-kondate-accent" : "text-kondate-muted hover:bg-kondate-bg"].join(" ")}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </div>
    </nav>
  );
}
