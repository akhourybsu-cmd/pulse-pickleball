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
  refund_state?: 'none' | 'pending' | 'failed';
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
    refund_review_only?: boolean;
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
  if (order.refund_state === 'failed') return order.canceled_at ? 'Canceled · refund needs attention' : 'Refund needs attention';
  if (order.refund_state === 'pending') return order.canceled_at ? 'Canceled · refund processing' : 'Refund processing';
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
export function refundNotice(order: Pick<PaymentOrder, 'refund_state' | 'canceled_at' | 'livemode'>): string | null {
  const booking = !order.livemode ? 'This is a test purchase; no real reservation exists.' : order.canceled_at ? 'Your reservation remains canceled; it has not been rebooked.' : 'Your reservation has not been canceled.';
  if (order.refund_state === 'failed') return `The refund did not complete. The venue needs to review it and arrange the next step with you. Only completed refunds count toward the refunded amount shown. ${booking}`;
  if (order.refund_state === 'pending') return `Stripe is processing the refund or awaiting required information. It is not yet counted as money returned. ${booking}`;
  return null;
}
export function cancellationLabel(status: string): string {
  return ({ requested: 'Sent to venue · awaiting review', refund_pending: 'Refund in progress', refund_failed: 'Refund needs owner attention', approved: 'Cancellation approved', declined: 'Request declined' } as Record<string,string>)[status] || 'Request under review';
}
export function canRequestCancellation(order: PaymentOrder): boolean {
  const request = order.payment_cancellation_requests;
  return order.kind === 'court_rental' && ['paid','partially_refunded','refunded'].includes(order.status) && !order.canceled_at && (!request || (request.refund_review_only === true && request.status === 'approved'));
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
