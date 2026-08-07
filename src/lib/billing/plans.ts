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
    description: "まず家庭で回るか試すためのプラン",
    features: ["4週間テンプレート1本", "公式メニューで月間生成デモ", "今日・買い物画面"],
  },
  {
    id: "family_monthly",
    name: "家族プラン",
    priceLabel: "月480円",
    description: "夫婦・家族で毎日の夕飯運営を共有するプラン",
    stripePriceEnv: "STRIPE_PRICE_FAMILY_MONTHLY",
    highlighted: true,
    features: ["栄養バランス献立の自動生成", "マイメニューと料理写真の保存", "家族共有・買い物同期", "季節テンプレート"],
  },
  {
    id: "family_yearly",
    name: "家族プラン 年払い",
    priceLabel: "年4,800円",
    description: "2か月分お得に、家庭の定番運用として使うプラン",
    stripePriceEnv: "STRIPE_PRICE_FAMILY_YEARLY",
    features: ["月払いの全機能", "年払い割引", "テンプレート改善の先行利用"],
  },
];

export function getPaidPlan(planId: BillingPlanId): BillingPlan {
  const plan = billingPlans.find((item) => item.id === planId);
  if (!plan || !plan.stripePriceEnv) {
    throw new Error("Paid billing plan is required");
  }
  return plan;
}
