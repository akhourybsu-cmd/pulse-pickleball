import { createClient } from "npm:@supabase/supabase-js@2.58.0";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Venue email preferences</title><body style="font:16px/1.7 Arial,sans-serif;max-width:560px;margin:60px auto;padding:24px;color:#15251d"><h1>Venue email preferences</h1>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
Deno.serve(async (req) => {
  if (!["GET", "POST"].includes(req.method))
    return html("<p>Use the unsubscribe link in your email.</p>", 405);
  const token = new URL(req.url).searchParams.get("token");
  if (
    !token ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      token,
    )
  )
    return html(
      "<p>This link is invalid. Open the unsubscribe link in your venue email.</p>",
      400,
    );
  // GET never changes preferences: mail-client link scanners cannot unsubscribe players.
  if (req.method === "GET")
    return html(
      '<p>Stop receiving email updates from this venue. Your bookings and other venues’ preferences stay the same.</p><form method="post"><button style="padding:12px 20px">Unsubscribe from this venue</button></form>',
    );
  const { data, error } = await db.rpc("venue_email_unsubscribe", {
    p_token: token,
  });
  return error
    ? html("<p>We could not save your preference. Please try again.</p>", 503)
    : data
      ? html(
          "<p>You are unsubscribed from this venue’s email updates. You can subscribe again in the venue’s notification settings.</p>",
        )
      : html(
          "<p>This link is no longer available. You can update email preferences in PULSE.</p>",
          400,
        );
});
