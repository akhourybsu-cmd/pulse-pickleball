const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
export function createVenueUnsubscribeHandler(
  unsubscribe: (token: string) => Promise<boolean>,
) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (!["GET", "POST"].includes(req.method))
      return json({ error: "Use the link in your venue email." }, 405);
    let token = new URL(req.url).searchParams.get("token");
    if (!token && req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 1000) return json({ error: "Invalid link." }, 400);
      try {
        token = JSON.parse(raw)?.token;
      } catch {
        /* Invalid input is rejected below. */
      }
    }
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        token,
      )
    )
      return json(
        {
          error:
            "This link is invalid. Open the unsubscribe link in your venue email.",
        },
        400,
      );
    // Browsers confirm in the web app. Link scanners never change consent.
    if (req.method === "GET")
      return new Response(null, {
        status: 303,
        headers: {
          ...headers,
          Location: `https://pulsepb.com/venue-email/unsubscribe?token=${token}`,
        },
      });
    try {
      return (await unsubscribe(token))
        ? json({ success: true })
        : json(
            {
              error:
                "This link is no longer available. Update your preferences in PULSE.",
            },
            400,
          );
    } catch {
      return json(
        { error: "We could not save your preference. Please try again." },
        503,
      );
    }
  };
}
