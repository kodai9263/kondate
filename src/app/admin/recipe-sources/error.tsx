"use client";
export default function SourceError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-4 py-10"><h1 className="text-xl font-bold">提供元・承諾情報を読み込めませんでした</h1><p className="mt-4 text-sm">時間をおいて再度お試しください。</p><button onClick={reset} className="mt-5 min-h-11 rounded border px-4">再読み込み</button></main>;
}
