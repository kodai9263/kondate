"use client";

import { useRef } from "react";
import { signup } from "@/app/(auth)/actions";
import { AuthField, AuthSubmit } from "@/components/features/auth/AuthFields";

export function SignupForm({ inviteToken, signupSource, campaignFields = {}, placement = "signup" }: {
  inviteToken?: string | null;
  signupSource?: string | null;
  campaignFields?: Record<string, string>;
  placement?: "signup" | "monitor_inline";
}) {
  const started = useRef(false);
  function track(name: string) {
    if (signupSource !== "monitor") return;
    const analyticsWindow = window as typeof window & {
      gtag?: (command: "event", name: string, params: Record<string, string>) => void;
    };
    // 入力値は送らず、入力開始と送信の段階だけを記録する。登録完了とは区別する。
    analyticsWindow.gtag?.("event", name, { placement });
  }
  return (
    <form action={signup} className="space-y-4" onChange={() => {
      if (!started.current) {
        started.current = true;
        track("monitor_signup_start");
      }
    }} onSubmit={() => track("monitor_signup_submit")}>
      {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
      {signupSource ? <input type="hidden" name="signupSource" value={signupSource} /> : null}
      {Object.entries(campaignFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <AuthField id="displayName" label="お名前" autoComplete="name" helper="ニックネームでも登録できます。" maxLength={40} />
      <AuthField id="email" label="メールアドレス" type="email" autoComplete="email" />
      <AuthField id="password" label="パスワード" type="password" autoComplete="new-password" helper="8文字以上で設定してください。" maxLength={128} />
      <AuthSubmit>{signupSource === "monitor" ? "無料モニターを始める（0円）" : "無料アカウントを作る"}</AuthSubmit>
    </form>
  );
}
