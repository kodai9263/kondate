"use client";

import { Check, Copy } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function InviteLinkField({ url }: { url: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  async function copyLink() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setStatus("error");
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          aria-label="家族の招待リンク"
          aria-describedby={statusId}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-12 w-full min-w-0 rounded border border-kondate-line bg-white px-3 text-base text-kondate-ink"
        />
        <Button variant="secondary" className="shrink-0" disabled={status === "copying"} onClick={copyLink}>
          {status === "copied" ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {status === "copied" ? "コピーしました" : "リンクをコピー"}
        </Button>
      </div>
      <p id={statusId} role="status" className="mt-2 text-xs leading-5 text-kondate-muted">
        {status === "error"
          ? "コピーできませんでした。リンク欄を長押し、または選択してコピーしてください。"
          : status === "copied"
            ? "招待リンクをコピーしました。LINEなどに貼り付けて家族に送れます。"
            : "リンクをコピーして、LINEなどで家族に送ってください。"}
      </p>
    </div>
  );
}
