// Local Vite fixture only. Not imported by the app or included in its build.
// Mutations are blocked and queries use fixed, non-personal sample data.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import Payments from "../../src/pages/player/Payments";
import { AuthStateProvider } from '../../src/hooks/useAuthState';
import "../../src/index.css";

onlineManager.setOnline(false);
const query = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const venue = "10000000-0000-4000-8000-000000000004";
const config = { mode: "test", livemode: false, cadence: "monthly", ready: true };
const policy =
  "Cancel at least 24 hours before your court time for a full refund. For weather closures, contact the venue and we will arrange a refund or a new time.";
const orders = [
  {
    id: "sample-rental",
    kind: "court_rental",
    description: "Court 2 · 90 minutes",
    merchant_name: "ELEVENO Pickleball",
    amount_cents: 3000,
    currency: "usd",
    status: "paid",
    refunded_cents: 0,
    billing_cadence: "one_time",
    livemode: false,
    created_at: "2026-09-09T14:00:00Z",
    start_time: "2026-09-12T17:00:00Z",
    end_time: "2026-09-12T18:30:00Z",
    policy_snapshot: policy,
    payment_intent_id: "sample",
    canceled_at: null,
  },
  {
    id: "sample-module",
    kind: "venue_module",
    description: "Court booking — ELEVENO Pickleball",
    merchant_name: "PULSE Pickleball",
    amount_cents: 1000,
    currency: "usd",
    status: "paid",
    refunded_cents: 0,
    billing_cadence: "monthly",
    livemode: false,
    created_at: "2026-09-08T14:00:00Z",
    policy_snapshot:
      "$10 USD per month. Renews automatically until canceled. Cancel before renewal in Profile. Access continues through the paid period.",
    payment_intent_id: "sample",
    canceled_at: null,
  },
];
const future = { updatedAt: Date.now() + 86_400_000 };
query.setQueryData(["payment-config", undefined], config, future);
query.setQueryData(
  ["payment-history", null, 0, undefined],
  { orders, has_more: false, legacy_leagues: [], legacy_tournaments: [] },
  future
);
query.setQueryData(
  ["payment-history", venue, 0, undefined],
  {
    orders: [orders[0]],
    has_more: false,
    legacy_leagues: [],
    legacy_tournaments: [],
  },
  future
);
query.setQueryData(
  ["payment-wallet", undefined],
  {
    merchants: [
      { account_id: "acct_example", merchant_name: "PULSE Pickleball" },
      { account_id: "acct_venue", merchant_name: "ELEVENO Pickleball" },
    ],
  },
  future
);
query.setQueryData(
  ["venue-payments", venue, undefined],
  {
    ...config,
    venue: {
      id: venue,
      name: "ELEVENO Pickleball",
      verification_approved_at: "2026-09-01",
    },
    settings: {
      accepting_payments: false,
      cancellation_policy: policy,
      support_email: "bookings@example.com",
      timezone: "America/New_York",
      tax_inclusive_acknowledged: true,
    },
    account: {
      account_id: "acct_example",
      charges_enabled: true,
      payouts_enabled: true,
      card_payments_active: true,
      updated_at: '2026-09-10T12:00:00Z',
    },
    transferred: false,
    booking_enabled: true,
    connect_existing_available: true,
    courts: [
      { id: "one", name: "Court 1 · Indoor", hourly_rate: 20 },
      { id: "two", name: "Court 2 · Indoor", hourly_rate: 20 },
    ],
  },
  future
);
query.setQueryData(
  ["venue-payment-requests", venue, undefined],
  {
    requests: [
      {
        id: "sample-request",
        order_id: "sample-rental",
        note: "One of our players cannot make it. Could we cancel this booking?",
        status: "requested",
        payment_orders: orders[0],
      },
    ],
  },
  future
);
const isVenue = new URLSearchParams(window.location.search).has("venue");
const mobile = new URLSearchParams(window.location.search).has('mobile');
createRoot(document.getElementById("root")!).render(
  mobile ? <iframe title="390px venue payment preview" className="mx-auto block border" width="390" height="844" src="./preview.html?venue" /> :
  <QueryClientProvider client={query}>
    <AuthStateProvider>
    <MemoryRouter
      initialEntries={[
        isVenue ? `/player/payments?venue=${venue}` : "/player/payments",
      ]}
    >
      <div
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest("button,a")) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div className="border-b bg-muted px-4 py-2 text-center text-xs">
          Local visual fixture · sample data · all actions disabled
        </div>
        <Payments />
      </div>
    </MemoryRouter>
    </AuthStateProvider>
  </QueryClientProvider>
);
