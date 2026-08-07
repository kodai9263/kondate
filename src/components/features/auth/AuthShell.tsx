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
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex min-h-11 items-center gap-2 font-black text-kondate-ink">
          <span className="grid size-10 place-items-center rounded-lg bg-kondate-accent text-white">
            <ChefHat size={22} aria-hidden="true" />
          </span>
          きょうのごはん
        </Link>
        <section className="border-2 border-kondate-ink border-t-4 border-t-kondate-accent bg-kondate-surface p-5 sm:p-7">
          <h1 className="font-mincho text-3xl font-black leading-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-kondate-muted">{description}</p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
