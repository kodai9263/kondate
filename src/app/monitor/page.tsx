import { redirect } from "next/navigation";
import { getCampaignFields } from "@/lib/marketing/campaignParams";

export default async function MonitorPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 過去の募集リンクも、流入元を保持して通常のサービス紹介へ案内する。
  const query = new URLSearchParams(getCampaignFields(await searchParams)).toString();
  redirect(query ? `/?${query}` : "/");
}
