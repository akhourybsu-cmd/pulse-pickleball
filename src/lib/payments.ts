import { supabase } from "@/integrations/supabase/client";

export interface PaymentConfig {
  mode: "off" | "test" | "live";
  livemode: boolean;
  cadence: "monthly";
  ready?: boolean;
  setup_issues?: string[];
}
export interface PaymentOrder {
  id: string;
  kind: string;
  description: string;
  merchant_name: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "expired" | "partially_refunded" | "refunded";
  livemode: boolean;
  refunded_cents: number;
  disputed: boolean;
  billing_cadence: string;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  policy_snapshot: string;
  canceled_at: string | null;
  payment_intent_id: string | null;
  venue_id: string | null;
  payment_cancellation_requests?: {
    status: string;
    resolution_note: string | null;
  } | null;
}
export interface CourtQuote extends PaymentConfig {
  venue_id: string;
  merchant_name: string;
  amount_cents: number;
  currency: string;
  description: string;
  policy: string;
  support_email: string;
  timezone: string;
  hourly_rate: number;
}
export async function paymentApi<T = Record<string, unknown>>(
  action: string,
  values: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("payments", {
    body: { action, ...values },
  });
  if (error) {
    let message = "Payments are unavailable. Please try again.";
    try {
      const body = await error.context?.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* Do not expose transport internals. */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100
  );
}
export function paymentStatus(order: PaymentOrder): string {
  if (order.canceled_at)
    return order.refunded_cents >= order.amount_cents
      ? "Canceled · refunded"
      : "Canceled · see refund amount";
  if (order.disputed) return "Dispute recorded";
  return {
    pending: "Awaiting payment",
    paid: "Paid",
    expired: "Checkout expired",
    partially_refunded: "Partially refunded",
    refunded: "Refunded",
  }[order.status];
}
export function openStripe(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !(
      parsed.hostname === "stripe.com" ||
      parsed.hostname.endsWith(".stripe.com")
    )
  )
    throw new Error("Invalid secure payment destination.");
  window.location.assign(parsed.href);
}
