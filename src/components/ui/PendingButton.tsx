"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

export function PendingButton({ children, pendingLabel = "保存しています..." }: { children: React.ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} fullWidth className="disabled:cursor-wait">{pending ? pendingLabel : children}</Button>;
}
