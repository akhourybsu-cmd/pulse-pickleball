export type EmailProvider = "pulse" | "resend" | "sendgrid" | "postmark";
export interface EmailEnvelope {
  id: string;
  provider: EmailProvider;
  key: string;
  from: string;
  name: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  stream?: string;
  unsubscribeUrl?: string;
}
export type DeliveryResult = {
  status: "accepted" | "failed" | "unknown" | "retry";
  providerId?: string;
  error?: string;
};
/** Fixed provider origins: a venue can never redirect its key to an arbitrary host. */
export async function deliverVenueEmail(
  e: EmailEnvelope,
  request: typeof fetch = fetch,
): Promise<DeliveryResult> {
  if (
    !e.key ||
    /[\r\n<>]/.test(e.from + e.to + e.replyTo) ||
    /[\r\n<>]/.test(e.name)
  )
    return {
      status: "failed",
      error: "Check the sender and provider credentials.",
    };
  const from = `${JSON.stringify(e.name)} <${e.from}>`;
  const unsub = e.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${e.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : {};
  let url: string, headers: Record<string, string>, body: unknown;
  if (e.provider === "pulse" || e.provider === "resend") {
    url = "https://api.resend.com/emails";
    headers = {
      Authorization: `Bearer ${e.key}`,
      "Idempotency-Key": `venue-email/${e.id}`,
    };
    body = {
      from,
      to: [e.to],
      reply_to: e.replyTo,
      subject: e.subject,
      html: e.html,
      text: e.text,
      headers: unsub,
    };
  } else if (e.provider === "sendgrid") {
    url = "https://api.sendgrid.com/v3/mail/send";
    headers = { Authorization: `Bearer ${e.key}` };
    body = {
      personalizations: [{ to: [{ email: e.to }] }],
      from: { email: e.from, name: e.name },
      reply_to: { email: e.replyTo },
      subject: e.subject,
      content: [
        { type: "text/plain", value: e.text },
        { type: "text/html", value: e.html },
      ],
      headers: unsub,
      custom_args: { pulse_venue_email_id: e.id },
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
    };
  } else if (e.provider === "postmark") {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(e.stream || ""))
      return {
        status: "failed",
        error: "Enter a valid Postmark Broadcast stream ID.",
      };
    try {
      const check = await request(
        `https://api.postmarkapp.com/message-streams/${encodeURIComponent(e.stream!)}`,
        {
          headers: {
            "X-Postmark-Server-Token": e.key,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        },
      );
      if (!check.ok)
        return {
          status: "failed",
          error:
            "Check your Postmark Server API token and Broadcast stream ID.",
        };
      const stream = await check.json();
      if (stream.MessageStreamType !== "Broadcasts" || stream.ArchivedAt)
        return {
          status: "failed",
          error:
            "Choose an active Postmark Broadcast stream for venue updates.",
        };
    } catch {
      return {
        status: "retry",
        error: "Postmark stream verification is temporarily unavailable.",
      };
    }
    url = "https://api.postmarkapp.com/email";
    headers = { "X-Postmark-Server-Token": e.key };
    body = {
      From: from,
      To: e.to,
      ReplyTo: e.replyTo,
      Subject: e.subject,
      HtmlBody: e.html,
      TextBody: e.text,
      MessageStream: e.stream,
      TrackOpens: false,
      TrackLinks: "None",
      Headers: Object.entries(unsub).map(([Name, Value]) => ({ Name, Value })),
      Metadata: { pulse_venue_email_id: e.id },
    };
  } else
    return { status: "failed", error: "Choose a supported email provider." };
  try {
    const r = await request(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (r.status === 429)
      return {
        status: "retry",
        error: "Provider rate limit reached. A retry is scheduled.",
      };
    if (r.status >= 500)
      return {
        status: "unknown",
        error:
          "Provider response was uncertain. Check its activity log before sending again.",
      };
    if (!r.ok)
      return {
        status: "failed",
        error: [401, 403].includes(r.status)
          ? "Check the API key, sending permissions, and verified sender in your provider."
          : "The provider rejected this email. Check the sender, message stream, and recipient in its dashboard.",
      };
    if (e.provider === "sendgrid")
      return {
        status: "accepted",
        providerId: r.headers.get("x-message-id")?.slice(0, 200),
      };
    const data = await r.json();
    if (e.provider === "postmark" && data.ErrorCode !== 0)
      return {
        status: "failed",
        error:
          "Postmark rejected this email. Check its sender and broadcast stream settings.",
      };
    const id = data.id || data.MessageID;
    return typeof id === "string"
      ? { status: "accepted", providerId: id.slice(0, 200) }
      : {
          status: "unknown",
          error:
            "The provider did not return a message ID. Check its activity log before sending again.",
        };
  } catch {
    return {
      status: "unknown",
      error:
        "Delivery could not be confirmed. Check your provider’s activity log before sending again.",
    };
  }
}
