import Link from "next/link";
import { z } from "zod";

export function SupportContact() {
  const email = z.string().trim().email().safeParse(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

  return email.success ? (
    <a className="inline-flex min-h-11 max-w-full items-center break-all text-kondate-accent underline underline-offset-4" href={`mailto:${email.data}`}>
      {email.data}
    </a>
  ) : (
    <p>
      メール窓口は準備中です。ログインできる場合は、
      <Link href="/account" className="underline underline-offset-4">Web版の設定にある「アプリへのご意見」</Link>
      からご連絡ください。
    </p>
  );
}
