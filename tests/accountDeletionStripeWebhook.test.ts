import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getStripe: vi.fn(), buildRecord: vi.fn(), getAdmin: vi.fn() }));
vi.mock("@/lib/billing/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/billing/subscriptionSync", () => ({
  buildSubscriptionUpsert: mocks.buildRecord,
  resolveCheckoutSubscription: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getAdmin }));

import { POST } from "@/app/api/stripe/webhook/route";

function request() {
  return new Request("https://example.test/api/stripe/webhook", {
    method: "POST", headers: { "stripe-signature": "valid" }, body: "event",
  });
}

function fakeAdmin(deleted: boolean) {
  const upsert = vi.fn(async () => ({ error: null }));
  const maybeSingle = vi.fn(async () => ({ data: deleted ? { id: "receipt-1" } : null, error: null }));
  const from = vi.fn((table: string) => table === "account_deletion_requests"
    ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }
    : { upsert });
  mocks.getAdmin.mockReturnValue({ from });
  return { from, upsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "test-secret";
  process.env.ACCOUNT_DELETION_ENABLED = "true";
  mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: () => ({
    type: "customer.subscription.updated", data: { object: {} },
  }) } });
  mocks.buildRecord.mockReturnValue({ household_id: "household-1", status: "active" });
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.ACCOUNT_DELETION_ENABLED;
});

describe("退会後のStripe通知", () => {
  it("最後の家族の退会後に契約行を復活させない", async () => {
    const { upsert } = fakeAdmin(true);
    expect((await POST(request())).status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("退会していない家族の契約は通常どおり更新する", async () => {
    const { upsert } = fakeAdmin(false);
    expect((await POST(request())).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({ household_id: "household-1", status: "active" }, { onConflict: "household_id" });
  });
});
