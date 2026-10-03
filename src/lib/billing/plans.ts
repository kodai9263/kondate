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
    description: "料理を探し、献立と買い物を14日間試すプラン",
    features: ["登録不要のメニュー・材料・作り方", "お気に入り・わが家のメニュー保存", "登録から14日間、献立と買い物リストを無料体験", "カード登録・自動課金なし"],
  },
  {
    id: "family_monthly",
    name: "家族プラン",
    priceLabel: "月480円",
    description: "無料体験後も献立と買い物をまとめて準備するプラン",
    stripePriceEnv: "STRIPE_PRICE_FAMILY_MONTHLY",
    highlighted: true,
    features: ["無料プランの全機能", "家族の招待と継続共有", "家族間のチェック同期", "週間・月間献立と買い物リストの継続利用"],
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
