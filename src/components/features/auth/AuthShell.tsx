import { ChefHat } from "lucide-react";
import Link from "next/link";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-kondate-bg px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* ロゴは朱の四角にアイコンを詰める形をやめ、線画と名前だけにする */}
        <Link href="/" className="mb-7 flex min-h-11 items-center justify-center gap-2 text-kondate-ink">
          <ChefHat size={20} className="text-kondate-accent" aria-hidden="true" />
          <span className="font-mincho text-lg font-bold">きょうのごはん</span>
        </Link>
        <section className="rounded-lg border border-kondate-line bg-white p-6 sm:p-8">
          <h1 className="font-mincho text-2xl font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-kondate-muted">{description}</p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
