import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { privatePaymentTestAllowed } from './payment-private-sandbox.ts';
import { stripeRequestOptions } from './payment-stripe-options.ts';
import {
  assertPaymentConfiguration,
  billingMode,
} from "./payment-contracts.ts";

export const env = (key: string) => Deno.env.get(key);
export const appOrigin = () => "https://pulsepb.com";
export const db = () =>
  createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export function checked<T extends { error: any; data: any }>(
  result: T
): T["data"] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function runtime() {
  const config = assertPaymentConfiguration(env);
  const stripe = new Stripe(env("PULSE_STRIPE_SECRET_KEY")!, {
    apiVersion: "2025-08-27.basil",
    maxNetworkRetries: 2,
    timeout: 15_000,
  });
  const account = await stripe.accounts.retrieve();
  if (account.id !== env("PULSE_STRIPE_ACCOUNT_ID"))
    throw new Error("PULSE Stripe account mismatch. Checkout is disabled.");
  return { ...config, stripe, platform: account.id, store: db() };
}
export type Runtime = Awaited<ReturnType<typeof runtime>>;
export function options(r: Runtime, account: string, key?: string) {
  return stripeRequestOptions(r.platform, account, key);
}
export async function authenticate(req: Request, store = db()) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new Error("Sign in to manage payments.");
  const { data, error } = await store.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at)
    throw new Error("Sign in with a confirmed email to manage payments.");
  return data.user;
}
export async function owner(
  store: ReturnType<typeof db>,
  userId: string,
  venueId: string
) {
  const venue = checked(
    await store
      .from("venues")
      .select("id,name,owner_id,verification_approved_at,stripe_account_id")
      .eq("id", venueId)
      .single()
  );
  if (!venue || venue.owner_id !== userId)
    throw new Error(
      "Only the current venue owner can manage billing or funds."
    );
  const sample = checked(await store.from('private_venue_sandboxes').select('owner_id,test_payments_enabled').eq('venue_id', venueId).maybeSingle());
  const paymentTestSandbox = privatePaymentTestAllowed(sample, venue.owner_id, userId, billingMode(env).mode, env('PULSE_PAYMENT_TEST_USER_IDS') || '');
  if (sample && !paymentTestSandbox) throw new Error('Billing is disabled for private sample venues except approved owner-only test payments.');
  return { ...venue, payment_test_sandbox: paymentTestSandbox };
}
export async function customer(
  r: Runtime,
  user: { id: string; email?: string },
  account: string,
  merchant: string
) {
  const existing = checked(
    await r.store
      .from("payment_customers")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_id", account)
      .eq("livemode", r.livemode)
      .maybeSingle()
  );
  if (existing) return existing.customer_id as string;
  const created = await r.stripe.customers.create(
    { email: user.email, metadata: { pulse_user_id: user.id } },
    options(r, account, `customer:${r.livemode}:${user.id}:${account}`)
  );
  checked(
    await r.store
      .from("payment_customers")
      .upsert(
        {
          user_id: user.id,
          account_id: account,
          livemode: r.livemode,
          customer_id: created.id,
          merchant_name: merchant,
        },
        { onConflict: "user_id,account_id,livemode" }
      )
  );
  return created.id;
}
export function headers(req: Request) {
  const origin = req.headers.get("origin");
  const allowed =
    origin === appOrigin() ||
    origin === "https://www.pulsepb.com" ||
    (billingMode(env).mode !== "live" &&
      ["http://localhost:8080", "http://127.0.0.1:8080"].includes(
        origin || ""
      ));
  if (origin && !allowed)
    throw new Error("This payment request must come from PULSE.");
  return {
    "Access-Control-Allow-Origin": origin || appOrigin(),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}
