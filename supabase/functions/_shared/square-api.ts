export type SquareConfig = {
  applicationId: string;
  applicationSecret: string;
  live: boolean;
  webhookKey: string;
  webhookUrl: string;
};
export function squareConfiguration(
  env: (name: string) => string | undefined,
): SquareConfig | null {
  const mode = env("PULSE_SQUARE_MODE");
  const applicationId = env("PULSE_SQUARE_APPLICATION_ID");
  const applicationSecret = env("PULSE_SQUARE_APPLICATION_SECRET");
  const webhookKey = env("PULSE_SQUARE_WEBHOOK_SIGNATURE_KEY");
  const backend = env("SUPABASE_URL");
  if (
    !["test", "live"].includes(mode || "") ||
    !applicationId ||
    !applicationSecret ||
    !webhookKey ||
    !backend ||
    (mode === "live" && env("PULSE_SQUARE_LIVE_APPROVED") !== "true")
  )
    return null;
  return {
    applicationId,
    applicationSecret,
    live: mode === "live",
    webhookKey,
    webhookUrl: `${backend}/functions/v1/square-webhook`,
  };
}
export const squareOrigin = (live: boolean) =>
  live ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
export const squareScopes = [
  "MERCHANT_PROFILE_READ",
  "ORDERS_READ",
  "ORDERS_WRITE",
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
  "DISPUTES_READ",
];
export async function squareRequest(
  config: Pick<SquareConfig, "live">,
  token: string | null,
  path: string,
  body?: unknown,
  method?: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`${squareOrigin(config.live)}${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2026-09-16",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.errors?.length) {
    // Never expose provider responses containing credentials or customer details.
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "Square needs reconnection or additional account permissions.",
      );
    throw new Error(
      "Square could not confirm this request. Refresh payment status before trying again.",
    );
  }
  return result;
}
export async function hashState(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function validSquareSignature(
  key: string,
  url: string,
  raw: string,
  signature: string | null,
) {
  if (!signature) return false;
  try {
    const secret = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      secret,
      Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(url + raw),
    );
  } catch {
    return false;
  }
}
export function squareCheckoutRequest(
  order: any,
  location: string,
  returnUrl: string,
) {
  if (
    order.provider !== "square" ||
    order.billing_cadence !== "one_time" ||
    order.kind !== "venue_sale" ||
    order.currency !== "usd" ||
    !Number.isSafeInteger(order.amount_cents) ||
    order.amount_cents < 50
  )
    throw new Error("Unsupported Square checkout.");
  return {
    idempotency_key: `pulse-${order.id}`,
    order: {
      location_id: location,
      reference_id: order.id,
      line_items: [
        {
          name: order.description,
          quantity: "1",
          base_price_money: { amount: order.amount_cents, currency: "USD" },
        },
      ],
      pricing_options: { auto_apply_discounts: false, auto_apply_taxes: false },
    },
    checkout_options: {
      redirect_url: returnUrl,
      allow_tipping: false,
      ask_for_shipping_address: false,
      accepted_payment_methods: {
        apple_pay: true,
        google_pay: true,
        cash_app_pay: false,
        afterpay_clearpay: false,
      },
    },
    payment_note: `PULSE ${order.id}`,
  };
}
export function assertSquareOrder(order: any, remote: any, location: string) {
  if (
    !remote ||
    remote.id !== order.processor_order_id ||
    remote.reference_id !== order.id ||
    remote.location_id !== location ||
    remote.total_money?.amount !== order.amount_cents ||
    remote.total_money?.currency !== "USD"
  )
    throw new Error(
      "Square payment details do not match this booking. Payment needs review.",
    );
}
export function assertSquarePayment(
  order: any,
  payment: any,
  location: string,
) {
  if (
    !payment ||
    payment.order_id !== order.processor_order_id ||
    payment.location_id !== location ||
    payment.total_money?.amount !== order.amount_cents ||
    payment.total_money?.currency !== "USD" ||
    payment.status !== "COMPLETED"
  )
    throw new Error("Square has not confirmed the full payment.");
}
