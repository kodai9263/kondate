export type BillingPlanId = "free" | "family_monthly" | "family_yearly";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  priceLabel: string;
  description: string;
  stripePriceEnv?: "STRIPE_PRICE_FAMILY_MONTHLY" | "STRIPE_PRICE_FAMILY_YEARLY";
  features: string[];
  highlighted?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "無料",
    priceLabel: "0円",
    description: "ひとりで献立管理を試すプラン",
    features: ["月間献立の作成・保存", "今日の段取り", "週の買い物目安と手動追加"],
  },
  {
    id: "family_monthly",
    name: "家族プラン",
    priceLabel: "月480円",
    description: "夫婦・家族で毎日の夕飯運営を共有するプラン",
    stripePriceEnv: "STRIPE_PRICE_FAMILY_MONTHLY",
    highlighted: true,
    features: ["無料プランの全機能", "家族の招待と継続共有", "家族間のチェック同期", "わが家のメニュー登録"],
  },
  {
    id: "family_yearly",
    name: "家族プラン 年払い",
    priceLabel: "年4,800円",
    description: "2か月分お得に、家庭の定番運用として使うプラン",
    stripePriceEnv: "STRIPE_PRICE_FAMILY_YEARLY",
    features: ["月払いの全機能", "2か月分お得", "1契約で家族全員が利用可能"],
  },
];

export function getPaidPlan(planId: BillingPlanId): BillingPlan {
  const plan = billingPlans.find((item) => item.id === planId);
  if (!plan || !plan.stripePriceEnv) {
    throw new Error("Paid billing plan is required");
  }
  return plan;
}
