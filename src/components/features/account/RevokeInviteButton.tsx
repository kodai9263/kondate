"use client";

import { useState } from "react";
import { revokeFamilyInvite } from "@/app/account/actions";
import { Button } from "@/components/ui/Button";
import { PendingButton } from "@/components/ui/PendingButton";

export function RevokeInviteButton({ inviteId, memberName }: { inviteId: string; memberName?: string }) {
  const [confirming, setConfirming] = useState(false);
  const label = memberName ? "共有を解除" : "招待を無効にする";
  if (!confirming) return <Button variant="danger" className="text-xs" onClick={() => setConfirming(true)}>{label}</Button>;

  return (
    <div className="w-full rounded border border-kondate-line bg-white p-3">
      <p className="mb-3 text-sm leading-6">{memberName ? `${memberName}さんとの共有を解除しますか？ この家族の献立・買い物リストを見たり変更したりできなくなります。家族のデータは残ります。` : "この招待リンクを無効にしますか？ このリンクでは参加できなくなります。"}</p>
      <form action={revokeFamilyInvite}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <PendingButton pendingLabel="変更しています...">{label}</PendingButton>
      </form>
      <Button variant="secondary" fullWidth className="mt-2" onClick={() => setConfirming(false)}>キャンセル</Button>
    </div>
  );
}
