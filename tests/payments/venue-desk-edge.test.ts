import { beforeEach, expect, it, vi } from "vitest";
import { authorizePaymentRecovery } from "../../supabase/functions/_shared/payment-recovery-auth";
import { stripeRequestOptions } from "../../supabase/functions/_shared/payment-stripe-options";
const checkout = vi.hoisted(() => ({
  start: vi.fn(async (_r: any, order: any, buyer: any) => ({ order, buyer })),
  account: vi.fn(async () => ({ account_id: "acct_venue" })),
}));
vi.mock("../../supabase/functions/_shared/payment-runtime.ts", () => ({
  checked: (r: any) => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
  options: (r: any, a: string, k?: string) =>
    stripeRequestOptions(r.platform, a, k),
}));
vi.mock("../../supabase/functions/_shared/payment-connect.ts", () => ({
  requireRentalAccount: checkout.account,
}));
vi.mock("../../supabase/functions/_shared/payment-checkout.ts", () => ({
  startCheckout: checkout.start,
  reconcileOrder: vi.fn(async (_r: any, o: any) => o),
}));
vi.mock("../../supabase/functions/_shared/payment-refunds.ts", () => ({
  reconcileRefundPayment: vi.fn(),
}));
import { venueDeskPayment } from "../../supabase/functions/_shared/payment-venue-desk";
const id = (n: number) =>
  `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function setup() {
  const data: Record<string, any> = {
    venues: { id: id(1), owner_id: id(2) },
    venue_staff: [{ role: "staff", is_active: true, status: "active" }],
    venue_customers: { id: id(3), venue_id: id(1) },
    payment_subscriptions: {
      subscription_id: "sub_member",
      venue_id: id(1),
      order_id: id(4),
      account_id: "acct_venue",
      livemode: true,
    },
    payment_orders: {
      id: id(4),
      venue_id: id(1),
      venue_sale_id: id(5),
      kind: "venue_sale",
      livemode: true,
      buyer_id: null,
      amount_cents: 2500,
    },
    venue_sales: { id: id(5), venue_id: id(1), product_kind: "membership" },
  };
  const writes: any[] = [];
  const rpc = vi.fn(async (name: string) => ({
    data: name === "venue_has_module" ? true : data.payment_orders,
    error: null,
  }));
  const r: any = {
    platform: "acct_platform",
    livemode: true,
    store: {
      rpc,
      from: (table: string) => {
        const q: any = {
          select: () => q,
          eq: () => q,
          single: async () => ({ data: data[table] }),
          update: (value: any) => {
            writes.push({ table, value });
            return q;
          },
          then: (resolve: any) =>
            Promise.resolve({ data: data[table] }).then(resolve),
        };
        return q;
      },
      auth: {
        admin: {
          getUserById: vi.fn(async (user: string) => ({
            data: { user: { id: user, email: "player@example.test" } },
          })),
        },
      },
    },
    stripe: {
      subscriptions: {
        retrieve: vi.fn(async () => ({
          id: "sub_member",
          livemode: true,
          status: "active",
          cancel_at_period_end: false,
        })),
        update: vi.fn(async () => ({
          status: "active",
          cancel_at_period_end: true,
        })),
      },
    },
  };
  return { r, data, writes, rpc };
}
beforeEach(() => vi.clearAllMocks());
it("reserves the quoted sale as the staff actor and never uses staff identity as the buyer", async () => {
  const { r, data, rpc } = setup();
  const body = {
    action: "venue_sale_checkout",
    customer_id: id(3),
    product_id: id(6),
    quantity: 1,
    amount_cents: 2500,
    request_key: id(7),
    accept_terms: true,
  };
  const result = await venueDeskPayment(
    r,
    { id: id(8), email: "staff@example.test" },
    body
  );
  expect(rpc).toHaveBeenCalledWith(
    "payment_reserve_venue_sale",
    expect.objectContaining({
      p_actor: id(8),
      p_customer: id(3),
      p_expected: 2500,
      p_request: id(7),
    })
  );
  expect(result.buyer).toEqual({ id: "" });
  data.payment_orders.buyer_id = id(9);
  expect((await venueDeskPayment(r, { id: id(8) }, body)).buyer).toEqual({
    id: id(9),
    email: "player@example.test",
  });
  expect(checkout.start.mock.calls[0][1]).toBe(data.payment_orders);
});
it("rejects missing staff access and unaccepted quotes before reserving or creating checkout", async () => {
  const { r, data, rpc } = setup();
  data.venue_staff = [];
  const body = {
    action: "venue_walkin_checkout",
    customer_id: id(3),
    amount_cents: 1000,
    accept_terms: true,
    request_key: id(7),
  };
  await expect(venueDeskPayment(r, { id: id(8) }, body)).rejects.toThrow(
    /desk access/
  );
  data.venue_staff = [{ role: "manager", is_active: true, status: "active" }];
  await expect(
    venueDeskPayment(r, { id: id(8) }, { ...body, accept_terms: false })
  ).rejects.toThrow(/policy/);
  expect(rpc.mock.calls.some((c) => c[0].startsWith("payment_reserve"))).toBe(
    false
  );
  expect(checkout.start).not.toHaveBeenCalled();
});
it("only the owner can stop renewal, with a scoped idempotent Stripe request and retained paid access", async () => {
  const { r, writes } = setup();
  const body = {
    action: "venue_membership_cancel",
    subscription_id: "sub_member",
    confirm_cancel: true,
    request_key: id(7),
  };
  await expect(venueDeskPayment(r, { id: id(8) }, body)).rejects.toThrow(
    /owner/
  );
  expect(r.stripe.subscriptions.update).not.toHaveBeenCalled();
  expect(await venueDeskPayment(r, { id: id(2) }, body)).toEqual({
    canceled: true,
  });
  expect(r.stripe.subscriptions.update).toHaveBeenCalledWith(
    "sub_member",
    { cancel_at_period_end: true },
    expect.objectContaining({
      stripeAccount: "acct_venue",
      idempotencyKey: `venue-renewal-cancel:sub_member:${id(7)}`,
    })
  );
  expect(writes[0].value).toEqual(
    expect.objectContaining({
      status: "active",
      cancel_at_period_end: true,
      cancel_requested_by: id(2),
    })
  );
  r.stripe.subscriptions.retrieve.mockResolvedValue({
    id: "sub_member",
    livemode: true,
    status: "active",
    cancel_at_period_end: true,
  });
  await venueDeskPayment(r, { id: id(2) }, body);
  expect(r.stripe.subscriptions.update).toHaveBeenCalledTimes(1);
});
it("rejects a subscription in the wrong Stripe environment before mutation", async () => {
  const { r, data } = setup();
  data.payment_subscriptions.livemode = false;
  await expect(
    venueDeskPayment(
      r,
      { id: id(2) },
      {
        action: "venue_membership_cancel",
        subscription_id: "sub_member",
        confirm_cancel: true,
        request_key: id(7),
      }
    )
  ).rejects.toThrow(/environment/);
  expect(r.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
});
it("recovery accepts only POST with a validated scheduler credential, never player JWTs or failed validation", async () => {
  const validate = vi.fn(async () => true),
    secret = "s".repeat(32);
  const request = (headers: Record<string, string>, method = "POST") =>
    new Request("https://example.test/recovery", { method, headers });
  expect(
    await authorizePaymentRecovery(
      request({ authorization: "Bearer player-token" }),
      secret,
      validate
    )
  ).toBe(false);
  expect(
    await authorizePaymentRecovery(
      request({ "x-payment-reconcile-secret": secret }, "GET"),
      secret,
      validate
    )
  ).toBe(false);
  expect(validate).not.toHaveBeenCalled();
  expect(
    await authorizePaymentRecovery(
      request({ "x-payment-reconcile-secret": secret }),
      secret,
      validate
    )
  ).toBe(true);
  expect(
    await authorizePaymentRecovery(
      request({ "x-dispatch-secret": secret }),
      undefined,
      validate
    )
  ).toBe(true);
  validate.mockResolvedValue(false);
  expect(
    await authorizePaymentRecovery(
      request({ "x-dispatch-secret": secret }),
      undefined,
      validate
    )
  ).toBe(false);
  validate.mockRejectedValue(new Error("offline"));
  expect(
    await authorizePaymentRecovery(
      request({ "x-dispatch-secret": secret }),
      undefined,
      validate
    )
  ).toBe(false);
});
