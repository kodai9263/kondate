import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function LegalPage({ title, updated = "2026年8月1日", children }: { title: string; updated?: string; children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6"><Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-kondate-muted"><ArrowLeft size={18} />トップへ</Link><article className="mt-5 rounded-lg border border-kondate-line bg-white p-5 sm:p-8"><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-xs text-kondate-muted">最終更新: {updated}</p><div className="legal-copy mt-8 space-y-7 text-sm leading-7 text-kondate-ink">{children}</div></article></main>;
}
