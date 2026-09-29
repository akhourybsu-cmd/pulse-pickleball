export const paymentProviders = [
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Online reservations, event registration, recurring memberships and front-desk checkout.",
    capabilities: [
      "Online bookings",
      "Payment links / QR",
      "Recurring memberships",
      "Refunds",
    ],
    availability: "available",
  },
  {
    id: "square",
    name: "Square",
    description:
      "Connect your existing Square business and choose the location that receives front-desk payments.",
    capabilities: [
      "Payment links / QR",
      "Walk-ins",
      "Lessons & deposits",
      "Refunds",
    ],
    availability: "available",
  },
  {
    id: "clover",
    name: "Clover",
    description:
      "For venues already using Clover. Online checkout and terminal support require separate integrations.",
    capabilities: [],
    availability: "planned",
  },
  {
    id: "paypal",
    name: "PayPal",
    description:
      "PayPal and eligible Venmo checkout. PULSE platform approval is required before this connection can launch.",
    capabilities: [],
    availability: "planned",
  },
  {
    id: "authorize_net",
    name: "Authorize.net",
    description:
      "Hosted checkout for venues using an existing Authorize.net gateway.",
    capabilities: [],
    availability: "planned",
  },
  {
    id: "adyen",
    name: "Adyen",
    description:
      "An option for larger operators with multiple locations. Requires an agreed platform integration.",
    capabilities: [],
    availability: "planned",
  },
] as const;
export type PaymentProvider = (typeof paymentProviders)[number]["id"];
export type ProviderConnection = {
  id: string;
  provider: PaymentProvider;
  merchant_name: string;
  location_id: string | null;
  location_name: string | null;
  status: "connected" | "needs_attention" | "paused";
  connected_by: string;
  updated_at: string;
  livemode: boolean;
};
export type ProviderWorkspace = {
  connections: ProviderConnection[];
  desk_provider: "stripe" | "square";
  online_provider: "stripe";
  square_available: boolean;
  square_issue: string | null;
  stripe_connected: boolean;
  requests: string[];
};
export function providerName(value: string | null | undefined) {
  return (
    paymentProviders.find((p) => p.id === value)?.name ||
    (value === "cash" ? "Cash" : "Card payment")
  );
}
export function securePaymentUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !(
      host === "stripe.com" ||
      host.endsWith(".stripe.com") ||
      host === "square.link" ||
      host === "checkout.square.site" ||
      host === "connect.squareup.com" ||
      host === "connect.squareupsandbox.com" ||
      host === "squareupsandbox.com" ||
      host === "squareup.com"
    )
  ) {
    throw new Error("Invalid secure payment destination.");
  }
  return url.href;
}
