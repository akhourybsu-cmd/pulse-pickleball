export const PRODUCT_KINDS = {
  membership: "Membership",
  visit_pass: "Visit pass",
  court_hours: "Court-hour pack",
  lesson_pack: "Lesson pack",
  guest_pass: "Guest pass",
  merchandise: "Merchandise",
  equipment_rental: "Equipment rental",
} as const;
export type ProductKind = keyof typeof PRODUCT_KINDS;
export interface VenueProduct {
  id: string;
  name: string;
  description: string;
  kind: ProductKind;
  price_cents: number;
  billing_cadence: "one_time" | "monthly";
  units: number;
  valid_days: number;
  member_discount_percent: number;
  stock: number | null;
  active: boolean;
  updated_at: string;
}
export interface VenueSale {
  needs_refund_review?: boolean;
  id: string;
  customer_id: string;
  product_name: string;
  product_kind: ProductKind;
  quantity: number;
  amount_cents: number;
  refunded_cents: number;
  method: "cash" | "stripe";
  payment_provider?: 'stripe' | 'square';
  status: string;
  billing_cadence: string;
  created_at: string;
  paid_at: string | null;
  first_name: string;
  last_name: string;
  receipt_token: string;
}
export interface VenueEntitlement {
  id: string;
  name: string;
  kind: ProductKind;
  remaining_units: number;
  total_units: number;
  expires_at: string;
  revoked_at: string | null;
}
export interface DeskWorkspace {
  memberships?: {
    subscription_id: string;
    status: string;
    paid_through: string | null;
    cancel_at_period_end: boolean;
    first_name: string;
    last_name: string;
    product_name: string;
    customer_id: string;
  }[];
  equipment?: {
    id: string;
    customer_id: string;
    product_name: string;
    outstanding: number;
    first_name: string;
    last_name: string;
    paid_at: string;
  }[];
  can_manage: boolean;
  is_owner: boolean;
  timezone: string;
  policy?: string | null;
  cash_collected_cents: number;
  cash_refunded_cents: number;
  cash_expected_cents: number;
  products: VenueProduct[];
  sales: VenueSale[];
  entitlements: VenueEntitlement[];
  closing: {
    counted_cents: number;
    expected_cents: number;
    created_at: string;
    note: string;
  } | null;
}
export function localVenueDay(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join("-");
}
export function priceCents(value: FormDataEntryValue | null) {
  const text = String(value || "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text))
    throw new Error("Enter a dollar amount with up to two decimal places.");
  return Math.round(Number(text) * 100);
}
