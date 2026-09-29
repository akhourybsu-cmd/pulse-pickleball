import { describe, it, expect, vi } from "vitest";
import {
  squareConfiguration,
  squareCheckoutRequest,
  assertSquareOrder,
  assertSquarePayment,
  squareRequest,
  validSquareSignature,
  hashState,
} from "../../supabase/functions/_shared/square-api";
import { securePaymentUrl } from "@/lib/venues/paymentProviders";
const order = {
  id: "order",
  provider: "square",
  kind: "venue_sale",
  billing_cadence: "one_time",
  currency: "usd",
  amount_cents: 2500,
  description: "Lesson deposit",
  processor_order_id: "sq-order",
};
describe("Square payment contract", () => {
  it("does not enable an unconfigured or unapproved live application", () => {
    const config: Record<string, string> = {
      PULSE_SQUARE_MODE: "live",
      PULSE_SQUARE_APPLICATION_ID: "app",
      PULSE_SQUARE_APPLICATION_SECRET: "secret",
      PULSE_SQUARE_WEBHOOK_SIGNATURE_KEY: "signature",
      SUPABASE_URL: "https://backend.example",
    };
    expect(squareConfiguration((k) => config[k])).toBeNull();
    config.PULSE_SQUARE_LIVE_APPROVED = "true";
    expect(squareConfiguration((k) => config[k])?.live).toBe(true);
    delete config.PULSE_SQUARE_WEBHOOK_SIGNATURE_KEY;
    expect(squareConfiguration((k) => config[k])).toBeNull();
  });
  it("uses deterministic checkout and tax-inclusive venue prices", () => {
    const body = squareCheckoutRequest(
      order,
      "loc",
      "https://pulsepb.com/venue-payment/token",
    );
    expect(body).toMatchObject({
      idempotency_key: "pulse-order",
      order: {
        location_id: "loc",
        reference_id: "order",
        pricing_options: { auto_apply_taxes: false },
        line_items: [{ base_price_money: { amount: 2500, currency: "USD" } }],
      },
      checkout_options: { allow_tipping: false },
    });
    expect(() =>
      squareCheckoutRequest(
        { ...order, billing_cadence: "monthly" },
        "loc",
        "return",
      ),
    ).toThrow();
  });
  it("requires the original location, reference, amount, currency and completed payment", () => {
    const remote = {
      id: "sq-order",
      reference_id: "order",
      location_id: "loc",
      total_money: { amount: 2500, currency: "USD" },
    };
    expect(() => assertSquareOrder(order, remote, "loc")).not.toThrow();
    for (const patch of [
      { id: "other" },
      { reference_id: "other" },
      { location_id: "other" },
      { total_money: { amount: 2501, currency: "USD" } },
      { total_money: { amount: 2500, currency: "CAD" } },
    ])
      expect(() =>
        assertSquareOrder(order, { ...remote, ...patch }, "loc"),
      ).toThrow();
    const payment = {
      order_id: "sq-order",
      location_id: "loc",
      total_money: { amount: 2500, currency: "USD" },
      status: "COMPLETED",
    };
    expect(() => assertSquarePayment(order, payment, "loc")).not.toThrow();
    expect(() =>
      assertSquarePayment(order, { ...payment, status: "APPROVED" }, "loc"),
    ).toThrow();
  });
  it("verifies the exact notification URL and body, rejecting altered or missing signatures", async () => {
    const secret = "test-signing-key",
      url = "https://backend.example/functions/v1/square-webhook",
      body = '{"merchant_id":"merchant"}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(url + body),
          ),
        ),
      ),
    );
    expect(await validSquareSignature(secret, url, body, signature)).toBe(true);
    expect(await validSquareSignature(secret, url, body + " ", signature)).toBe(
      false,
    );
    expect(await validSquareSignature(secret, url + "/", body, signature)).toBe(
      false,
    );
    expect(await validSquareSignature(secret, url, body, null)).toBe(false);
    expect(await hashState("one")).not.toEqual(await hashState("two"));
  });
  it("keeps provider credentials and raw errors out of user messages", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ errors: [{ detail: "private credential here" }] }),
          { status: 500 },
        ),
      );
    await expect(
      squareRequest(
        { live: true },
        "secret",
        "/v2/payments",
        undefined,
        undefined,
        fetcher,
      ),
    ).rejects.toThrow("Square could not confirm");
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://connect.squareup.com/v2/payments",
    );
  });
  it("accepts only explicit secure payment destinations", () => {
    for (const url of [
      "https://square.link/u/test",
      "https://checkout.square.site/test",
      "https://connect.squareup.com/oauth2/authorize",
      "https://checkout.stripe.com/test",
    ])
      expect(securePaymentUrl(url)).toBe(url);
    for (const url of [
      "https://square.link.evil.test/x",
      "http://square.link/u/x",
      "https://square.link@evil.test/x",
      "https://square.link:8443/u/x",
      "javascript:alert(1)",
    ])
      expect(() => securePaymentUrl(url)).toThrow();
  });
});
