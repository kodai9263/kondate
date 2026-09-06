"use client";

import { RotateCcw } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ResetRecipeStepsButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} onClick={(event) => {
    if (!window.confirm("アレンジした工程をやめて、公式の工程に戻しますか？")) event.preventDefault();
  }} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-kondate-muted hover:text-kondate-ink disabled:cursor-wait disabled:opacity-60"><RotateCcw size={17} aria-hidden="true" />{pending ? "戻しています…" : "公式の工程に戻す"}</button>;
}
