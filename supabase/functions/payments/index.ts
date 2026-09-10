import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  billingMode,
  MODULE_AMOUNT_CENTS,
  MODULE_BILLING_TERMS,
  moduleName,
  moneyInput,
  paymentLaunchIssues,
  uuid,
} from "../_shared/payment-contracts.ts";
import {
  appOrigin,
  authenticate,
  checked,
  customer,
  db,
  env,
  headers,
  options,
  owner,
  runtime,
} from "../_shared/payment-runtime.ts";
import { reconcileOrder, startCheckout } from "../_shared/payment-checkout.ts";
import { completeExisting, connectExisting, createOrRecoverVenueAccount, merchantPortal, refreshVenueAccount, requireRentalAccount } from '../_shared/payment-connect.ts';
import { reconcileRefundPayment } from '../_shared/payment-refunds.ts';

serve(async (req) => {
  let cors: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  try {
    cors = headers(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST")
      return new Response(JSON.stringify({ error: "POST required." }), {
        status: 405,
        headers: cors,
      });
    const store = db();
    const user = await authenticate(req, store);
    const body = await req.json();
    const configured = billingMode(env);
    const testAllowed = (env("PULSE_PAYMENT_TEST_USER_IDS") || "")
      .split(",")
      .map((id) => id.trim())
      .includes(user.id);
    const visibleMode =
      configured.mode === "test" && !testAllowed
        ? { ...configured, mode: "off" }
        : configured;
    const setupIssues = visibleMode.mode === 'off' ? ['PULSE has not enabled payment checkout yet.'] : paymentLaunchIssues(env);
    const config = { ...visibleMode, ready: setupIssues.length === 0, setup_issues: setupIssues };
    if (['status', 'venue'].includes(body.action) && config.ready) {
      try { await runtime(); } catch { config.ready = false; config.setup_issues = ['PULSE could not verify its Stripe connection. Checkout remains unavailable.']; }
    }
    const reply = (value: unknown) =>
      new Response(JSON.stringify(value), { headers: cors });

    if (body.action === "status")
      return reply({
        ...config,
        module_amount_cents: MODULE_AMOUNT_CENTS,
        currency: "usd",
      });
    if (body.action === "history") {
      const page =
        Number.isInteger(body.page) && body.page >= 0 && body.page < 1000
          ? body.page
          : 0;
      let query = store
        .from("payment_orders")
        .select("*,payment_cancellation_requests(status,resolution_note,refund_review_only)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * 25, page * 25 + 24);
      if (body.venue_id) {
        await owner(store, user.id, uuid(body.venue_id));
        query = query.eq("venue_id", body.venue_id).eq("kind", "court_rental");
      } else query = query.eq("buyer_id", user.id);
      const orders = checked(await query) || [];
      // Older purchases remain visible without inventing missing amounts or
      // treating complimentary tournament activation as a card charge.
      const legacy =
        page === 0 && !body.venue_id
          ? checked(
              await store
                .from("league_slot_purchases")
                .select(
                  "id,amount_cents,currency,status,created_at,stripe_session_id"
                )
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(100)
            )
          : [];
      const tournaments =
        page === 0 && !body.venue_id
          ? checked(
              await store
                .from("tournaments_events")
                .select(
                  "id,name,payment_status,stripe_checkout_session_id,created_at"
                )
                .eq("created_by", user.id)
                .not("stripe_checkout_session_id", "is", null)
                .order("created_at", { ascending: false })
                .limit(100)
            )
          : [];
      return reply({
        orders,
        legacy_leagues: legacy,
        legacy_tournaments: tournaments,
        has_more: orders.length === 25,
      });
    }
    if (body.action === "booking_details") {
      const court = checked(
        await store
          .from("venue_courts")
          .select("venue_id,hourly_rate")
          .eq("id", uuid(body.court_id))
          .single()
      );
      if (!court) throw new Error("Court not found.");
      if (
        !checked(
          await store
            .from("group_members")
            .select("user_id")
            .eq("user_id", user.id)
            .eq("group_id", uuid(body.group_id))
            .eq("status", "active")
            .maybeSingle()
        )
      )
        throw new Error("Join this venue before booking.");
      const group = checked(
        await store
          .from("groups")
          .select("venue_id")
          .eq("id", body.group_id)
          .single()
      );
      if (!group || group.venue_id !== court.venue_id)
        throw new Error("Court and community do not match.");
      const settings = checked(
        await store
          .from("venue_payment_settings")
          .select("*")
          .eq("venue_id", court.venue_id)
          .maybeSingle()
      );
      return reply({
        paid:
          !!settings &&
          Number(court.hourly_rate) > 0,
        hourly_rate: court.hourly_rate || 0,
        policy: settings?.cancellation_policy || "",
        ...config,
      });
    }
    if (body.action === "venue") {
      const venue = await owner(store, user.id, uuid(body.venue_id));
      const settings = checked(
        await store
          .from("venue_payment_settings")
          .select("*")
          .eq("venue_id", venue.id)
          .maybeSingle()
      );
      const account = checked(
        await store
          .from("venue_payment_accounts")
          .select("*")
          .eq("venue_id", venue.id)
          .eq("livemode", config.livemode)
          .maybeSingle()
      );
      const courts = checked(
        await store
          .from("venue_courts")
          .select("id,name,hourly_rate,is_active")
          .eq("venue_id", venue.id)
          .order("court_number")
      );
      return reply({
        ...config,
        venue,
        settings,
        account,
        courts,
        transferred: !!account && account.connected_by !== user.id,
        booking_enabled: !!checked(await store.rpc('venue_has_module', { p_venue_id: venue.id, p_module: 'court_booking' })),
        connect_existing_available: /^ca_[A-Za-z0-9]+$/.test(env('PULSE_STRIPE_CONNECT_CLIENT_ID') || ''),
      });
    }
    if (body.action === "save_venue") {
      const venue = await owner(store, user.id, uuid(body.venue_id));
      const policy = String(body.cancellation_policy || "").trim();
      const email = String(body.support_email || "").trim();
      const timezone = String(body.timezone || "").trim();
      if (
        policy.length < 20 ||
        policy.length > 2000 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      )
        throw new Error(
          "Enter a clear cancellation policy and a valid support email."
        );
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      } catch {
        throw new Error("Choose a valid venue time zone.");
      }
      if (!timezone || body.tax_inclusive_acknowledged !== true)
        throw new Error(
          "Confirm that your rates include any applicable taxes."
        );
      if (body.accepting_payments === true) {
        if (!config.ready) throw new Error('PULSE payment setup must be complete before enabling collections.');
        const r = await runtime();
        if (!r.livemode)
          throw new Error(
            "Test mode cannot turn on real rental charges. You can save your prices and policies as a draft."
          );
        const account = checked(
          await store
            .from("venue_payment_accounts")
            .select("*")
            .eq("venue_id", venue.id)
            .eq("livemode", true)
            .single()
        );
        const live = await requireRentalAccount(r, venue.id);
        if (
          account.connected_by !== user.id ||
          !venue.verification_approved_at ||
          !live.charges_enabled ||
          !live.payouts_enabled
        )
          throw new Error(
            "Complete ownership verification and Stripe onboarding first."
          );
        if (!checked(await store.rpc('venue_has_module', { p_venue_id: venue.id, p_module: 'court_booking' }))) throw new Error('Enable the court booking feature before accepting rental payments.');
      }
      checked(
        await store.rpc("payment_save_venue", {
          p_user: user.id,
          p_venue: venue.id,
          p_accepting: body.accepting_payments === true,
          p_policy: policy,
          p_email: email,
          p_timezone: timezone,
          p_rates: (body.rates || []).map((rate: any) => ({
            id: uuid(rate.id),
            cents: moneyInput(rate.price),
          })),
        })
      );
      return reply({ saved: true });
    }

    if (configured.mode === "test" && !testAllowed)
      throw new Error(
        "Payment testing is restricted to approved test accounts."
      );
    const r = await runtime();
    if (['module_checkout', 'court_checkout', 'quote', 'resume', 'save_card', 'onboard', 'connect_existing', 'complete_connect'].includes(body.action) && !config.ready) throw new Error('PULSE must finish payment setup before this action. No payment has been taken.');
    if (body.action === "cancellations") {
      await owner(store, user.id, uuid(body.venue_id));
      const requests = checked(
          await store
            .from("payment_cancellation_requests")
            .select(
              "*,payment_orders!inner(description,amount_cents,refunded_cents,status,livemode,start_time,end_time,canceled_at,refund_state,payment_intent_id,account_id)"
            )
            .eq("venue_id", body.venue_id)
            .eq('payment_orders.livemode', r.livemode)
            .in("status", ["requested", "refund_pending", "refund_failed"])
            .order("created_at")
            .limit(100)
        ) || [];
      const ids = [...new Set(requests.map((request: any) => request.buyer_id))];
      const profiles = ids.length ? checked(await store.from('profiles').select('id,display_name,full_name').in('id', ids)) || [] : [];
      return reply({ requests: requests.map((request: any) => {
        const profile = profiles.find((p: any) => p.id === request.buyer_id);
        return { ...request, player_name: profile?.display_name?.trim() || profile?.full_name?.trim() || 'Player' };
      }) });
    }
    if (body.action === 'check_refund') {
      const order = checked(await store.from('payment_orders').select('*').eq('id', uuid(body.order_id)).eq('livemode', r.livemode).single());
      await owner(store, user.id, order.venue_id);
      // Read-only processor action. Never creates or retries a refund.
      const account = checked(await store.from('venue_payment_accounts').select('account_id,connected_by,disconnected_at').eq('venue_id', order.venue_id).eq('livemode', r.livemode).single());
      if (!account || account.connected_by !== user.id || account.account_id !== order.account_id || account.disconnected_at) throw new Error('Financial ownership review is required before checking this payment.');
      if (!order.payment_intent_id) throw new Error('Payment is not settled yet.');
      await reconcileRefundPayment(r, order.account_id, order.payment_intent_id);
      return reply({ checked: true });
    }
    if (body.action === "resolve_cancellation") {
      const order = checked(
        await store
          .from("payment_orders")
          .select("*")
          .eq("id", uuid(body.order_id))
          .eq("kind", "court_rental")
          .eq("livemode", r.livemode)
          .single()
      );
      await owner(store, user.id, order.venue_id);
      const request = checked(await store.from('payment_cancellation_requests').select('status').eq('order_id', order.id).single());
      if (!request || request.status !== 'requested') throw new Error('This request has already been reviewed. Use Check refund status or review the original payment in Stripe; no new refund was issued.');
      if (body.decision === 'refund_pending') {
        const account = checked(await store.from('venue_payment_accounts').select('account_id,connected_by,disconnected_at').eq('venue_id', order.venue_id).eq('livemode', r.livemode).single());
        if (!account || account.connected_by !== user.id || account.account_id !== order.account_id || account.disconnected_at) throw new Error('Financial ownership review is required before refunding this payment.');
      }
      if (body.confirm !== true)
        throw new Error("Confirm the cancellation and refund decision.");
      const decision = body.decision;
      if (
        !["declined", "cancel_without_refund", "refund_pending"].includes(
          decision
        )
      )
        throw new Error("Choose a resolution.");
      checked(
        await store.rpc("payment_cancel_reservation", {
          p_order: order.id,
          p_owner: user.id,
          p_note: String(body.note || "").trim(),
          p_decision: decision,
        })
      );
      if (decision === "refund_pending") {
        if (!order.payment_intent_id)
          throw new Error("Missing payment reference.");
        const refund = await r.stripe.refunds.create(
          {
            payment_intent: order.payment_intent_id,
            reason: "requested_by_customer",
            metadata: { pulse_order_id: order.id },
          },
          options(r, order.account_id, `cancellation-refund:${order.id}`)
        );
        await reconcileRefundPayment(r, order.account_id, order.payment_intent_id);
        if (refund.status === 'failed' || refund.status === 'canceled') throw new Error('The refund did not complete. Review the payment in Stripe and contact the player; no second refund has been started.');
      }
      return reply({ resolved: true });
    }
    if (body.action === 'connect_existing' || body.action === 'complete_connect') {
      const venue = await owner(store, user.id, uuid(body.venue_id));
      if (!venue.verification_approved_at && !venue.payment_test_sandbox) throw new Error('Verify venue ownership before connecting payments.');
      const existing = checked(await store.from('venue_payment_accounts').select('*').eq('venue_id', venue.id).eq('livemode', r.livemode).maybeSingle());
      if (existing && existing.connected_by !== user.id) throw new Error('Financial ownership review is required before connecting this venue.');
      return reply(body.action === 'connect_existing'
        ? await connectExisting(r, user.id, venue.id, env('PULSE_STRIPE_CONNECT_CLIENT_ID') || '')
        : await completeExisting(r, user.id, venue.id, body.state, body.code));
    }
    if (body.action === "onboard" || body.action === "refresh_account") {
      const venue = await owner(store, user.id, uuid(body.venue_id));
      if (!venue.verification_approved_at && !venue.payment_test_sandbox)
        throw new Error(
          "Verify your venue ownership before connecting payments."
        );
      let account = checked(
        await store
          .from("venue_payment_accounts")
          .select("*")
          .eq("venue_id", venue.id)
          .eq("livemode", r.livemode)
          .maybeSingle()
      );
      if (account && account.connected_by !== user.id)
        throw new Error(
          "The venue changed owners. PULSE must review the financial account transfer before new collections."
        );
      if (!account && body.action === "onboard") {
        if (body.create_new_account !== true) throw new Error('Confirm a new, separate Stripe account for this venue, or connect its existing account.');
        if (r.livemode && venue.stripe_account_id)
          throw new Error(
            "This venue already references a Stripe account. PULSE must verify and link that account before creating another."
          );
        const created = await createOrRecoverVenueAccount(r, venue, user);
        account = checked(await store.rpc('payment_link_venue_account', { p_venue: venue.id, p_owner: user.id, p_live: r.livemode, p_account: created.id }));
      }
      if (!account) throw new Error('Connect this venue’s Stripe account first.');
      await refreshVenueAccount(r, account);
      if (body.action === "refresh_account") return reply({ refreshed: true });
      const link = await r.stripe.accountLinks.create({
        account: account.account_id,
        type: "account_onboarding",
        collection_options: { fields: 'eventually_due' },
        refresh_url: `${appOrigin()}/player/payments?venue=${
          venue.id
        }&connect=refresh`,
        return_url: `${appOrigin()}/player/payments?venue=${
          venue.id
        }&connect=returned`,
      });
      return reply({ url: link.url });
    }
    if (body.action === "module_checkout") {
      const venue = await owner(store, user.id, uuid(body.venue_id));
      if (!venue.verification_approved_at && !venue.payment_test_sandbox)
        throw new Error("Verify venue ownership before buying add-ons.");
      const name = moduleName(body.module_key);
      if (body.accept_terms !== true || body.cadence !== r.cadence)
        throw new Error("Review and accept the displayed billing terms.");
      const access = checked(
        await store.rpc("venue_has_module", {
          p_venue_id: venue.id,
          p_module: body.module_key,
        })
      );
      // Included sample access is never removed or converted into a paid grant.
      // The approved private sandbox can exercise test subscriptions separately.
      if (access && !venue.payment_test_sandbox)
        throw new Error(
          "This venue already has this add-on. No payment is needed."
        );
      const activeSub = checked(
        await store
          .from("payment_subscriptions")
          .select("subscription_id")
          .eq("venue_id", venue.id)
          .eq("module_key", body.module_key)
          .eq("livemode", r.livemode)
          .not("status", "in", "(canceled,incomplete_expired)")
          .limit(1)
      );
      if (activeSub?.length)
        throw new Error(
          "This add-on already has a subscription. Manage its billing in Profile."
        );
      const request = uuid(body.request_key);
      let order = checked(
        await store
          .from("payment_orders")
          .select("*")
          .eq("buyer_id", user.id)
          .eq("request_key", request)
          .eq("livemode", r.livemode)
          .maybeSingle()
      );
      if (
        order &&
        (order.venue_id !== venue.id ||
          order.module_key !== body.module_key ||
          order.billing_cadence !== r.cadence)
      )
        throw new Error(
          "This request belongs to a different purchase or billing schedule."
        );
      if (!order)
        order = checked(
          await store
            .from("payment_orders")
            .insert({
              buyer_id: user.id,
              venue_id: venue.id,
              kind: "venue_module",
              module_key: body.module_key,
              billing_cadence: r.cadence,
              description: `${name} — ${venue.name}`,
              merchant_name: "PULSE Pickleball",
              account_id: r.platform,
              livemode: r.livemode,
              amount_cents: MODULE_AMOUNT_CENTS,
              request_key: request,
              policy_snapshot: MODULE_BILLING_TERMS,
            })
            .select()
            .single()
        );
      return reply(await startCheckout(r, order, user));
    }
    if (body.action === "quote" || body.action === "court_checkout") {
      const args = {
        p_buyer: user.id,
        p_group: uuid(body.group_id),
        p_court: uuid(body.court_id),
        p_start: body.start_time,
        p_end: body.end_time,
        p_live: r.livemode,
      };
      // Fetch fresh Stripe capabilities before issuing a quote/hold. SQL remains
      // authoritative for buyer membership, destination, prices and inventory.
      const court = checked(await store.from('venue_courts').select('venue_id').eq('id', args.p_court).single());
      const membership = checked(await store.from('group_members').select('user_id').eq('group_id', args.p_group).eq('user_id', user.id).eq('status', 'active').maybeSingle());
      const group = checked(await store.from('groups').select('venue_id').eq('id', args.p_group).maybeSingle());
      if (!court || !membership || !group || group.venue_id !== court.venue_id) throw new Error('Join this venue community before booking.');
      await requireRentalAccount(r, court.venue_id);
      if (body.action === "quote")
        return reply({
          ...checked(await store.rpc("payment_court_quote", args)),
          ...config,
        });
      if (body.accept_terms !== true || !Number.isInteger(body.amount_cents))
        throw new Error(
          "Review the total and cancellation policy before paying."
        );
      const order = checked(
        await store.rpc("payment_reserve_court", {
          ...args,
          p_expected: body.amount_cents,
          p_policy: body.policy,
          p_request: uuid(body.request_key),
        })
      );
      return reply(await startCheckout(r, order, user));
    }
    if (
      [
        "reconcile",
        "resume",
        "cancel_checkout",
        "receipt",
        "request_cancellation",
      ].includes(body.action)
    ) {
      const order = checked(
        await store
          .from("payment_orders")
          .select("*")
          .eq("id", uuid(body.order_id))
          .eq("buyer_id", user.id)
          .single()
      );
      if (order.livemode !== r.livemode)
        throw new Error(
          "This purchase belongs to a different payment environment."
        );
      if (body.action === "resume")
        return reply(await startCheckout(r, order, user));
      if (body.action === "request_cancellation") {
        if (
          order.kind !== "court_rental" ||
          !["paid", "partially_refunded", "refunded"].includes(order.status)
        )
          throw new Error(
            "Only a paid court reservation can request cancellation."
          );
        checked(
          await store.rpc("payment_request_cancellation", {
            p_order: order.id,
            p_buyer: user.id,
            p_note: String(body.note || "").trim(),
          })
        );
        return reply({ requested: true });
      }
      if (body.action === "receipt") {
        if (!order.payment_intent_id)
          throw new Error("A receipt is available after payment confirmation.");
        const intent = await r.stripe.paymentIntents.retrieve(
          order.payment_intent_id,
          { expand: ["latest_charge"] },
          options(r, order.account_id)
        );
        const charge = intent.latest_charge;
        if (!charge || typeof charge === "string" || !charge.receipt_url)
          throw new Error("Receipt is not available yet.");
        return reply({ url: charge.receipt_url });
      }
      if (body.action === "cancel_checkout" && order.status === "pending") {
        if (!order.checkout_session_id)
          throw new Error(
            "Checkout preparation needs reconciliation. Contact PULSE; no new charge will be started."
          );
        const current = await r.stripe.checkout.sessions.retrieve(
          order.checkout_session_id,
          {},
          options(r, order.account_id)
        );
        if (current.status === "open")
          await r.stripe.checkout.sessions.expire(
            current.id,
            {},
            options(r, order.account_id, `expire:${order.id}`)
          );
      }
      const reconciledOrder = await reconcileOrder(r, order);
      if (body.action === 'reconcile' && reconciledOrder.payment_intent_id) {
        await reconcileRefundPayment(r, order.account_id, reconciledOrder.payment_intent_id);
      }
      return reply({ order: reconciledOrder });
    }
    if (body.action === "wallet") {
      const customers =
        checked(
          await store
            .from("payment_customers")
            .select("account_id,merchant_name")
            .eq("user_id", user.id)
            .eq("livemode", r.livemode)
        ) || [];
      return reply({
        merchants: [
          { account_id: r.platform, merchant_name: "PULSE Pickleball" },
          ...customers.filter((c: any) => c.account_id !== r.platform),
        ],
        ...config,
      });
    }
    if (body.action === "save_card" || body.action === "billing_portal") {
      const account = body.account_id || r.platform;
      let mapping = checked(
        await store
          .from("payment_customers")
          .select("*")
          .eq("user_id", user.id)
          .eq("account_id", account)
          .eq("livemode", r.livemode)
          .maybeSingle()
      );
      if (!mapping && account !== r.platform)
        throw new Error(
          "Purchase from this venue before managing saved cards for it."
        );
      const customerId =
        mapping?.customer_id ||
        (await customer(r, user, r.platform, "PULSE Pickleball"));
      if (body.action === "billing_portal") {
        // Hosted portal owns default-card, removal, invoice and subscription safeguards.
        const portal = await merchantPortal(r, account, customerId);
        return reply({ url: portal.url });
      }
      if (body.accept_terms !== true)
        throw new Error(
          "Confirm that you want Stripe to save this card for the selected merchant."
        );
      const session = await r.stripe.checkout.sessions.create(
        {
          mode: "setup",
          customer: customerId,
          payment_method_types: ["card"],
          setup_intent_data: {
            usage: "on_session",
            metadata: { pulse_user_id: user.id },
          },
          success_url: `${appOrigin()}/player/payments?card=saved`,
          cancel_url: `${appOrigin()}/player/payments`,
          custom_text: {
            submit: {
              message: `Save this card securely with Stripe for ${
                mapping?.merchant_name || "PULSE Pickleball"
              }. No purchase is made.`,
            },
          },
        },
        options(r, account, `save-card:${user.id}:${uuid(body.request_key)}`)
      );
      return reply({ url: session.url });
    }
    throw new Error("Unsupported payment action.");
  } catch (error) {
    // Never log request bodies, keys, payment-method details or hosted session URLs.
    const stripeError =
      typeof (error as any)?.type === "string" &&
      (error as any).type.startsWith("Stripe");
    const message = stripeError
      ? "Stripe could not complete the request. Check your purchase status before retrying."
      : error instanceof Error
      ? error.message
      : "Payments are unavailable. Please try again.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: cors,
    });
  }
});
