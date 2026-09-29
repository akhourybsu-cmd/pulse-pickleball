import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  request: vi.fn(),
  rpc: vi.fn(),
  record: {} as any,
  connection: {} as any,
  remote: {} as any,
}));
vi.mock("../../supabase/functions/_shared/payment-runtime.ts", () => ({
  checked: (r: any) => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
  env: (k: string) =>
    ({
      PULSE_PAYMENTS_MODE: "live",
      PULSE_SQUARE_MODE: "live",
      PULSE_SQUARE_APPLICATION_ID: "app",
      PULSE_SQUARE_APPLICATION_SECRET: "secret",
      PULSE_SQUARE_WEBHOOK_SIGNATURE_KEY: "signature",
      PULSE_SQUARE_LIVE_APPROVED: "true",
      SUPABASE_URL: "https://backend.test",
    })[k],
  db: () => null,
}));
vi.mock(
  "../../supabase/functions/_shared/square-api.ts",
  async (importOriginal) => ({
    ...(await importOriginal<any>()),
    squareRequest: mock.request,
  }),
);
import {
  reconcileSquareOrder,
  startSquareCheckout,
  refundSquareOrder,
} from "../../supabase/functions/_shared/square-payments";
const store: any = {
  rpc: mock.rpc,
  from: (table: string) => {
    let updates: any;
    const q: any = {
      select: () => q,
      eq: () => q,
      update: (value: any) => {
        updates = value;
        return q;
      },
      single: async () => ({
        data:
          table === "venue_sales"
            ? { receipt_token: "receipt" }
            : { ...mock.record },
      }),
      then: (resolve: any) => {
        if (updates) Object.assign(mock.record, updates);
        return Promise.resolve({ data: null }).then(resolve);
      },
    };
    return q;
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.record = {
    id: "order",
    provider: "square",
    kind: "venue_sale",
    billing_cadence: "one_time",
    venue_id: "venue",
    venue_sale_id: "sale",
    processor_connection_id: "conn",
    account_id: "square:conn",
    livemode: true,
    status: "pending",
    amount_cents: 2500,
    currency: "usd",
    description: "Lesson",
    checkout_session_id: "link",
    processor_order_id: "remote",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    refunded_cents: 0,
  };
  mock.connection = {
    id: "conn",
    provider: "square",
    venue_id: "venue",
    livemode: true,
    status: "connected",
    merchant_id: "merchant",
    location_id: "location",
    connected_by: "owner",
    token_expires_at: new Date(Date.now() + 5 * 86400_000).toISOString(),
  };
  mock.remote = {
    id: "remote",
    reference_id: "order",
    location_id: "location",
    total_money: { amount: 2500, currency: "USD" },
    state: "OPEN",
    tenders: [],
  };
  mock.rpc.mockImplementation(async (name: string, args: any) => {
    if (name === "venue_processor_credentials")
      return {
        data: {
          connection: mock.connection,
          credentials: { access_token: "private-token" },
        },
      };
    if (name === "payment_apply_result") {
      mock.record.status = args.p_status;
      mock.record.payment_intent_id = args.p_intent;
      return { data: { ...mock.record } };
    }
    if (name === "payment_begin_refund_sync") return { data: 1 };
    return { data: true };
  });
  mock.request.mockImplementation(
    async (
      _config: any,
      _token: any,
      path: string,
      body: any,
      method: string,
    ) => {
      if (path === "/v2/orders/remote") return { order: { ...mock.remote } };
      if (path.startsWith("/v2/disputes?")) return { disputes: [] };
      if (path === "/v2/locations/location")
        return {
          location: {
            id: "location",
            merchant_id: "merchant",
            status: "ACTIVE",
            currency: "USD",
            capabilities: ["CREDIT_CARD_PROCESSING"],
          },
        };
      if (path === "/v2/payments/payment")
        return {
          payment: {
            id: "payment",
            order_id: "remote",
            location_id: "location",
            total_money: { amount: 2500, currency: "USD" },
            status: "COMPLETED",
            refund_ids: [],
          },
        };
      if (method === "DELETE") {
        mock.remote.state = "CANCELED";
        return { cancelled_order_id: "remote" };
      }
      if (path === "/v2/online-checkout/payment-links")
        return {
          payment_link: {
            id: "link",
            order_id: "remote",
            url: "https://square.link/u/link",
          },
        };
      throw new Error("Unexpected provider request " + path);
    },
  );
});
it("does not mark an open checkout paid from a return URL or stored link", async () => {
  const result = await reconcileSquareOrder(store, { ...mock.record });
  expect(result.status).toBe("pending");
  expect(mock.rpc.mock.calls.some((c) => c[0] === "payment_apply_result")).toBe(
    false,
  );
});
it("requires provider-confirmed cancellation before expiring an inventory hold", async () => {
  const result = await reconcileSquareOrder(store, { ...mock.record }, true);
  expect(result.status).toBe("expired");
  expect(mock.request.mock.calls.some((c) => c[4] === "DELETE")).toBe(true);
  const args = mock.rpc.mock.calls.find(
    (c) => c[0] === "payment_apply_result",
  )![1];
  expect(args).toMatchObject({
    p_status: "expired",
    p_account: "square:conn",
    p_session: "link",
  });
});
it("keeps a hold when Square cancellation cannot be confirmed", async () => {
  mock.request.mockImplementation(async () => {
    throw new Error("Square unavailable");
  });
  await expect(
    reconcileSquareOrder(store, { ...mock.record }, true),
  ).rejects.toThrow("unavailable");
  expect(mock.record.status).toBe("pending");
});
it("verifies a completed payment before fulfillment and reconciles refund status separately", async () => {
  mock.remote.tenders = [{ payment_id: "payment" }];
  mock.remote.state = "COMPLETED";
  const result = await reconcileSquareOrder(store, { ...mock.record });
  expect(result.status).toBe("paid");
  expect(
    mock.rpc.mock.calls.find((c) => c[0] === "payment_apply_result")![1],
  ).toMatchObject({ p_intent: "payment", p_amount: 2500, p_status: "paid" });
  expect(
    mock.rpc.mock.calls.find(
      (c) => c[0] === "payment_apply_refund_snapshot",
    )![1],
  ).toMatchObject({ p_amount: 2500, p_attempts: [] });
});
it("rejects a merchant/location mismatch without granting the purchase", async () => {
  mock.remote.location_id = "other";
  mock.remote.tenders = [{ payment_id: "payment" }];
  await expect(reconcileSquareOrder(store, { ...mock.record })).rejects.toThrow(
    "do not match",
  );
  expect(mock.record.status).toBe("pending");
});
it("recovers a lost checkout response with the same idempotency key and persists the provider references", async () => {
  mock.record.checkout_session_id = null;
  mock.record.processor_order_id = null;
  await startSquareCheckout(store, { ...mock.record });
  expect(
    mock.request.mock.calls.find(
      (c) => c[2] === "/v2/online-checkout/payment-links",
    )![3].idempotency_key,
  ).toBe("pulse-order");
  expect(mock.record).toMatchObject({
    checkout_session_id: "link",
    processor_order_id: "remote",
    processor_checkout_url: "https://square.link/u/link",
  });
});
it("refuses duplicate or excessive refunds while a refund is processing", async () => {
  mock.record.status = "paid";
  mock.record.refund_state = "pending";
  mock.record.payment_intent_id = "payment";
  await expect(
    refundSquareOrder(store, { ...mock.record }, 2500, "request"),
  ).rejects.toThrow("remaining refundable");
  expect(mock.request.mock.calls.some((c) => c[2] === "/v2/refunds")).toBe(
    false,
  );
});

it("keeps pending and failed refunds separate from settled money and detects disputes on later pages", async () => {
  mock.remote.tenders = [{ payment_id: "payment" }];
  mock.remote.state = "COMPLETED";
  const original = mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (...args: any[]) => {
    const path = args[2];
    if (path === "/v2/payments/payment")
      return {
        payment: {
          id: "payment",
          order_id: "remote",
          location_id: "location",
          total_money: { amount: 2500, currency: "USD" },
          status: "COMPLETED",
          refund_ids: ["settled", "pending", "failed"],
        },
      };
    if (path.startsWith("/v2/refunds/")) {
      const id = path.split("/").pop();
      return {
        refund: {
          id,
          payment_id: "payment",
          location_id: "location",
          amount_money: { amount: 500, currency: "USD" },
          status: {
            settled: "COMPLETED",
            pending: "PENDING",
            failed: "FAILED",
          }[id],
        },
      };
    }
    if (path.startsWith("/v2/disputes?"))
      return path.includes("cursor=next")
        ? {
            disputes: [
              {
                location_id: "location",
                disputed_payment: { payment_id: "payment" },
              },
            ],
          }
        : { disputes: [], cursor: "next" };
    return original(...args);
  });
  await reconcileSquareOrder(store, { ...mock.record });
  const snapshot = mock.rpc.mock.calls.find(
    (c) => c[0] === "payment_apply_refund_snapshot",
  )![1];
  expect(
    snapshot.p_attempts.map((r: any) => ({
      amount: r.amount,
      status: r.status,
    })),
  ).toEqual([
    { amount: 500, status: "succeeded" },
    { amount: 500, status: "pending" },
    { amount: 500, status: "failed" },
  ]);
  expect(snapshot.p_disputed).toBe(true);
});
it("does not apply a refund belonging to another payment", async () => {
  mock.remote.tenders = [{ payment_id: "payment" }];
  mock.remote.state = "COMPLETED";
  const original = mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (...args: any[]) => {
    if (args[2] === "/v2/payments/payment")
      return {
        payment: {
          id: "payment",
          order_id: "remote",
          location_id: "location",
          total_money: { amount: 2500, currency: "USD" },
          status: "COMPLETED",
          refund_ids: ["wrong"],
        },
      };
    if (args[2] === "/v2/refunds/wrong")
      return {
        refund: {
          id: "wrong",
          payment_id: "other",
          location_id: "location",
          amount_money: { amount: 500, currency: "USD" },
          status: "COMPLETED",
        },
      };
    return original(...args);
  });
  await expect(reconcileSquareOrder(store, { ...mock.record })).rejects.toThrow(
    "Refund destination mismatch",
  );
  expect(
    mock.rpc.mock.calls.some((c) => c[0] === "payment_apply_refund_snapshot"),
  ).toBe(false);
});
