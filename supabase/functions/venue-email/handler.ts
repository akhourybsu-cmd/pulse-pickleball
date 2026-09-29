export const emailHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: emailHeaders });
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export interface EmailHandlerDeps {
  authorize(req: Request, venue: string): Promise<{ actor: string } | Response>;
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
  process(jobId: string): Promise<unknown>;
}
const setupMessages = new Set([
  "Settings changed. Refresh before saving.",
  "Settings changed. Refresh before continuing.",
  "Choose a provider and a valid sender name",
  "Enter valid sender and reply-to email addresses",
  "Check the footer and broadcast message stream",
  "Enter this provider’s sending API key",
  "Enter a valid provider API key",
  "Save the current sender settings before testing",
  "Five test emails per hour are available. Please wait before testing again.",
  "Confirm your PULSE account email before sending a test",
]);
const setupFallback =
  "Email setup could not be completed. Refresh the saved settings and check your venue access, sender details, and test limit.";
class EmailSetupError extends Error {}
export const safeSetupError = (message: string) =>
  new EmailSetupError(setupMessages.has(message) ? message : setupFallback);
export function createVenueEmailHandler(deps: EmailHandlerDeps) {
  return async (req: Request) => {
    if (req.method === "OPTIONS")
      return new Response(null, { headers: emailHeaders });
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);
    try {
      const raw = await req.text();
      if (raw.length > 16000)
        return json({ error: "The settings are too large." }, 413);
      let b: any;
      try {
        b = JSON.parse(raw);
      } catch {
        return json({ error: "Choose valid email settings." }, 400);
      }
      if (
        !uuid(b?.venueId) ||
        !["save", "test", "disconnect"].includes(b?.action) ||
        (b.expected !== null && !uuid(b.expected))
      )
        return json(
          { error: "Choose a venue and refresh its email settings." },
          400,
        );
      const auth = await deps.authorize(req, b.venueId);
      if (auth instanceof Response) return auth;
      const args = {
        p_venue: b.venueId,
        p_actor: auth.actor,
        p_expected: b.expected,
      };
      if (b.action === "save") {
        if (
          !b.document ||
          typeof b.document !== "object" ||
          Array.isArray(b.document) ||
          (b.key !== undefined &&
            (typeof b.key !== "string" || b.key.length > 1000))
        )
          return json({ error: "Check the sender settings and API key." }, 400);
        await deps.rpc("venue_email_save", {
          ...args,
          p_document: b.document,
          p_key: b.key || null,
        });
      } else if (b.action === "disconnect")
        await deps.rpc("venue_email_disconnect", args);
      else {
        if (!uuid(b.requestId))
          return json({ error: "Refresh before sending a test." }, 400);
        const job = await deps.rpc("venue_email_test", {
          ...args,
          p_request: b.requestId,
        });
        // Enqueue is durable. If immediate dispatch fails, the scheduled worker resumes it.
        try {
          await deps.process(job);
        } catch {
          /* Never expose provider credentials or raw database errors. */
        }
        return json({ ok: true, jobId: job });
      }
      return json({ ok: true });
    } catch (error) {
      return json(
        {
          error:
            error instanceof EmailSetupError ? error.message : setupFallback,
        },
        400,
      );
    }
  };
}
