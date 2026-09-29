import { checked, db, env, owner, runtime } from "./payment-runtime.ts";
import { requireRentalAccount } from "./payment-connect.ts";
import { uuid } from "./payment-contracts.ts";
import {
  hashState,
  squareConfiguration,
  squareOrigin,
  squareRequest,
  squareScopes,
} from "./square-api.ts";
import {
  requireSquareConfig,
  squareConnection,
  squareLocations,
  verifySquareForNewPayment,
} from "./square-payments.ts";

export async function providerSettings(
  store: ReturnType<typeof db>,
  user: { id: string },
  body: any,
) {
  if (!String(body.action).startsWith("provider_")) return undefined;
  const venue = uuid(body.venue_id);
  await owner(store, user.id, venue);
  if (body.action === "provider_workspace") {
    const connections = checked(
      await store
        .from("venue_processor_connections")
        .select(
          "id,provider,merchant_name,location_id,location_name,status,connected_by,updated_at,livemode",
        )
        .eq("venue_id", venue),
    );
    const preference = checked(
      await store
        .from("venue_processor_preferences")
        .select("desk_provider")
        .eq("venue_id", venue)
        .maybeSingle(),
    );
    const stripe = checked(
      await store
        .from("venue_payment_accounts")
        .select(
          "charges_enabled,payouts_enabled,card_payments_active,connected_by,disconnected_at,disabled_reason",
        )
        .eq("venue_id", venue)
        .eq("livemode", true)
        .maybeSingle(),
    );
    const requests = checked(
      await store
        .from("venue_processor_requests")
        .select("provider")
        .eq("venue_id", venue),
    );
    const config = squareConfiguration(env);
    return {
      connections,
      desk_provider: preference?.desk_provider || "stripe",
      online_provider: "stripe",
      square_available: !!config,
      square_issue: config
        ? config.live
          ? null
          : "Square is in test mode. Test connections cannot collect live venue payments."
        : "PULSE must configure its Square application before venues can connect.",
      stripe_connected:
        !!stripe &&
        stripe.connected_by === user.id &&
        stripe.charges_enabled &&
        stripe.payouts_enabled &&
        stripe.card_payments_active &&
        !stripe.disconnected_at &&
        !stripe.disabled_reason,
      requests: (requests || []).map((r: any) => r.provider),
    };
  }
  checked(
    await store.rpc("venue_processor_owner", {
      p_venue: venue,
      p_actor: user.id,
    }),
  );
  if (body.action === "provider_request") {
    if (!["clover", "paypal", "authorize_net", "adyen"].includes(body.provider))
      throw new Error("Choose a listed payment provider.");
    checked(
      await store
        .from("venue_processor_requests")
        .upsert(
          { venue_id: venue, provider: body.provider, requested_by: user.id },
          { onConflict: "venue_id,provider", ignoreDuplicates: true },
        ),
    );
    return { requested: true };
  }
  if (body.action === "provider_set_desk") {
    if (body.provider === "square") {
      const c = checked(
        await store
          .from("venue_processor_connections")
          .select("id")
          .eq("venue_id", venue)
          .eq("provider", "square")
          .eq("livemode", true)
          .single(),
      );
      await verifySquareForNewPayment(store, c.id);
    } else if (body.provider === "stripe")
      await requireRentalAccount(await runtime(), venue);
    checked(
      await store.rpc("venue_processor_set_desk", {
        p_venue: venue,
        p_actor: user.id,
        p_provider: body.provider,
      }),
    );
    return { saved: true };
  }
  const config = requireSquareConfig();
  if (body.action === "provider_connect") {
    const state = `${venue}.${crypto.randomUUID()}.${crypto.randomUUID()}`;
    checked(
      await store
        .from("venue_processor_oauth_states")
        .insert({
          state_hash: await hashState(state),
          venue_id: venue,
          actor_id: user.id,
          provider: "square",
          livemode: config.live,
        }),
    );
    const url = new URL("/oauth2/authorize", squareOrigin(config.live));
    url.search = new URLSearchParams({
      client_id: config.applicationId,
      scope: squareScopes.join(" "),
      state,
      session: "false",
      redirect_uri:
        "https://pulsepb.com/player/payments?payment_provider=square",
    }).toString();
    return { url: url.href };
  }
  if (body.action === "provider_complete") {
    if (
      typeof body.state !== "string" ||
      body.state.length > 250 ||
      typeof body.code !== "string" ||
      body.code.length > 1500
    )
      throw new Error("Invalid payment connection return.");
    checked(
      await store.rpc("venue_processor_consume_state", {
        p_hash: await hashState(body.state),
        p_actor: user.id,
        p_venue: venue,
        p_live: config.live,
      }),
    );
    const result = await squareRequest(config, null, "/oauth2/token", {
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      code: body.code,
      grant_type: "authorization_code",
      redirect_uri:
        "https://pulsepb.com/player/payments?payment_provider=square",
    });
    if (
      !result.access_token ||
      !result.refresh_token ||
      !result.merchant_id ||
      !Number.isFinite(Date.parse(result.expires_at))
    )
      throw new Error("Square did not confirm this connection.");
    const merchant = (
      await squareRequest(
        config,
        result.access_token,
        `/v2/merchants/${encodeURIComponent(result.merchant_id)}`,
      )
    ).merchant;
    if (merchant?.id !== result.merchant_id || merchant.status !== "ACTIVE")
      throw new Error("Choose an active Square business.");
    const id = checked(
      await store.rpc("venue_processor_store_square", {
        p_venue: venue,
        p_actor: user.id,
        p_live: config.live,
        p_merchant: result.merchant_id,
        p_name: merchant.business_name || "Square business",
        p_credentials: JSON.stringify({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        }),
        p_expires: result.expires_at,
      }),
    );
    return { connected: true, id };
  }
  const id = uuid(body.connection_id);
  const c = checked(
    await store
      .from("venue_processor_connections")
      .select("id,venue_id,connected_by")
      .eq("id", id)
      .eq("venue_id", venue)
      .single(),
  );
  if (c.connected_by !== user.id)
    throw new Error(
      "Financial ownership review is required for this connection.",
    );
  if (body.action === "provider_locations")
    return { locations: await squareLocations(store, id) };
  if (body.action === "provider_location") {
    const locations = await squareLocations(store, id);
    const location = locations.find((l: any) => l.id === body.location_id);
    if (!location)
      throw new Error(
        "Choose an active USD card-processing location for this business.",
      );
    checked(
      await store.rpc("venue_processor_select_location", {
        p_id: id,
        p_actor: user.id,
        p_location: location.id,
        p_name: location.name,
      }),
    );
    return { saved: true };
  }
  if (body.action === "provider_pause") {
    if (body.confirm !== true)
      throw new Error("Confirm pausing new collections.");
    checked(
      await store
        .from("venue_processor_connections")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", id),
    );
    // Keep the original account available for historical reconciliation/refunds.
    return { paused: true };
  }
  if (body.action === "provider_check") {
    const ctx = await squareConnection(store, id);
    const locations = await squareLocations(store, id);
    const location = locations.find(
      (l: any) => l.id === ctx.connection.location_id,
    );
    if (!location)
      throw new Error(
        "Choose a valid payment location before enabling collections.",
      );
    checked(
      await store.rpc("venue_processor_select_location", {
        p_id: id,
        p_actor: user.id,
        p_location: location.id,
        p_name: location.name,
      }),
    );
    return { checked: true };
  }
  throw new Error("Unknown payment connection action.");
}
