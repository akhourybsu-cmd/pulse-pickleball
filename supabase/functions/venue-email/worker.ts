import { renderVenueEmail } from "../_shared/venue-email-template.ts";
import { deliverVenueEmail, type DeliveryResult } from "./providers.ts";
export interface EmailWorkerDeps {
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
  managedKey?: string;
  baseUrl: string;
  deliver?: typeof deliverVenueEmail;
}
export async function processVenueEmail(
  deps: EmailWorkerDeps,
  jobId: string | null = null,
  limit = 10,
) {
  let processed = 0;
  const started = Date.now();
  for (let i = 0; i < limit; i++) {
    // Leave time for the current provider call and release the scheduler promptly.
    if (Date.now() - started >= 30000) break;
    const claim = await deps.rpc("venue_email_claim", { p_job: jobId });
    if (!claim) break;
    if (claim.skipped) continue;
    const { job: j, connection: c } = claim;
    const unsubscribeUrl =
      j.kind === "announcement"
        ? `${deps.baseUrl}/functions/v1/venue-email-unsubscribe?token=${j.unsubscribe_token}`
        : undefined;
    const content = renderVenueEmail(j.brand, {
      subject: j.subject,
      body: j.body,
      footer: j.footer,
      venueUrl: j.venue_url,
      unsubscribeUrl: unsubscribeUrl
        ? `https://pulsepb.com/venue-email/unsubscribe?token=${j.unsubscribe_token}`
        : undefined,
    });
    const key = c.provider === "pulse" ? deps.managedKey : claim.key;
    let result: DeliveryResult;
    if (!key)
      result = {
        status: "failed",
        error:
          "The email provider is not configured. Reconnect it or contact PULSE support.",
      };
    else
      result = await (deps.deliver || deliverVenueEmail)({
        id: j.id,
        provider: c.provider,
        key,
        from: c.provider === "pulse" ? "support@pulsepb.com" : c.from_email,
        name:
          c.provider === "pulse" ? `${c.sender_name} via PULSE` : c.sender_name,
        replyTo: c.reply_to,
        to: j.recipient_email,
        subject: j.subject,
        ...content,
        stream: c.message_stream,
        unsubscribeUrl,
      });
    await deps.rpc("venue_email_finish", {
      p_job: j.id,
      p_lease: j.lease,
      p_status: result.status,
      p_provider_id: result.providerId || null,
      p_error: result.error || null,
    });
    processed++;
    if (jobId) break;
  }
  return { processed };
}
