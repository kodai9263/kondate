"use client";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function AppError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-4 py-8"><h1 className="font-mincho text-2xl font-bold">読み込みできませんでした</h1><p role="alert" className="mt-4 text-sm leading-7 text-kondate-muted">利用状態や保存済みデータを確認できませんでした。時間をおいて再度お試しください。</p><div className="mt-5 flex flex-wrap gap-4"><Button onClick={reset}>再読み込み</Button><Link href="/menus" className="inline-flex min-h-11 items-center underline">無料のメニューを見る</Link></div></main>;
}
