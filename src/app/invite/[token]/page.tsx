import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { acceptFamilyInvite } from "@/app/invite/[token]/actions";
import { normalizeInviteToken } from "@/lib/family/invites";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvitePreview = {
  household_name: string;
  expires_at: string;
  accepted_at: string | null;
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const inviteToken = normalizeInviteToken(token);

  if (!inviteToken || !isSupabaseConfigured()) {
    return (
      <AuthShell title="招待リンクを確認できません" description="リンクが途中で切れていないか確認してください。">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-black text-kondate-accent"><ArrowLeft size={18} />トップへ戻る</Link>
      </AuthShell>
    );
  }

  const supabase = await getSupabaseServer();
  const [{ data: { user } }, { data: rawInvite }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_household_invite", { invite_token_input: inviteToken }).maybeSingle(),
  ]);
  const invite = rawInvite as InvitePreview | null;

  if (!invite) {
    return (
      <AuthShell title="招待リンクが使えません" description="期限切れ、またはすでに使用済みの可能性があります。">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-black text-kondate-accent"><ArrowLeft size={18} />トップへ戻る</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="家族グループに参加" description={`${invite.household_name} の献立と買い物リストを共有します。`}>
      {error === "accept" ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">参加できませんでした。招待リンクの期限を確認してください。</p> : null}
      <div className="rounded-lg border border-kondate-line bg-white p-4">
        <p className="flex items-center gap-2 font-black"><Users size={18} />{invite.household_name}</p>
        <p className="mt-2 text-sm leading-6 text-kondate-muted">参加すると、このアカウントで同じ家族グループの設定・献立・買い物リストを見られるようになります。</p>
      </div>
      {user ? (
        <form action={acceptFamilyInvite} className="mt-5">
          <input type="hidden" name="inviteToken" value={inviteToken} />
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-kondate-accent px-4 font-black text-white">この家族グループに参加</button>
        </form>
      ) : (
        <div className="mt-5 grid gap-3">
          <Link href={`/signup?invite=${inviteToken}`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-kondate-accent px-4 font-black text-white">無料登録して参加</Link>
          <Link href={`/login?invite=${inviteToken}`} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-kondate-line bg-white px-4 font-black text-kondate-ink">ログインして参加</Link>
        </div>
      )}
    </AuthShell>
  );
}
