// Pure helpers shared with the payment security tests. Never accept a client price as authoritative.
export const MODULE_AMOUNT_CENTS = 1000;
export const MODULE_BILLING_CADENCE = "monthly" as const;
export const MODULE_BILLING_TERMS =
  "$10 USD per feature per month. Renews automatically until canceled. Cancel before renewal in Profile → Payments & purchases. Access continues through the paid period.";
export const MODULES = {
  court_booking: "Court booking",
  facility_tools: "Facility operations",
} as const;
export type ModuleKey = keyof typeof MODULES;
export function moduleName(value: unknown): string {
  if (typeof value !== "string" || !Object.hasOwn(MODULES, value))
    throw new Error("Choose a supported venue add-on.");
  return MODULES[value as ModuleKey];
}
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new Error("Invalid request reference.");
  return value;
}
export function moneyInput(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value)
  )
    throw new Error("Enter a price with up to two decimal places.");
  const cents = Math.round(Number(value) * 100);
  if (cents > 99999999) throw new Error("Price is too high.");
  return cents;
}
export function billingMode(env: (name: string) => string | undefined) {
  const mode = env("PULSE_PAYMENTS_MODE") || "off";
  if (!["off", "test", "live"].includes(mode))
    throw new Error("Invalid payment mode.");
  const cadence = env("PULSE_MODULE_BILLING");
  if (cadence !== undefined && cadence !== MODULE_BILLING_CADENCE)
    throw new Error("Venue features require $10 USD monthly billing.");
  return {
    mode,
    livemode: mode === "live",
    cadence: MODULE_BILLING_CADENCE,
  };
}
export function assertPaymentConfiguration(
  env: (name: string) => string | undefined
) {
  const config = billingMode(env);
  const key = env("PULSE_STRIPE_SECRET_KEY") || "";
  if (config.mode === "off")
    throw new Error("Payments are not enabled yet. No payment has been taken.");
  if (!key.startsWith(config.livemode ? "sk_live_" : "sk_test_"))
    throw new Error("The Stripe key does not match the payment mode.");
  if (config.livemode && env("PULSE_PAYMENTS_LIVE_APPROVED") !== "true")
    throw new Error("Live payments have not been approved.");
  if (!/^acct_[a-zA-Z0-9]+$/.test(env("PULSE_STRIPE_ACCOUNT_ID") || ""))
    throw new Error("PULSE’s Stripe account must be verified first.");
  return config;
}
export function assertCheckoutMatches(order: any, session: any) {
  if (
    session.metadata?.pulse_order_id !== order.id ||
    session.client_reference_id !== order.id ||
    session.livemode !== order.livemode ||
    session.amount_total !== order.amount_cents ||
    session.currency !== order.currency ||
    (typeof session.customer === "string"
      ? session.customer
      : session.customer?.id) !== order.customer_id ||
    (order.checkout_session_id && session.id !== order.checkout_session_id) ||
    session.mode !==
      (order.billing_cadence === "monthly" ? "subscription" : "payment")
  ) {
    throw new Error(
      "Payment verification mismatch. Your purchase has not been granted."
    );
  }
}
