// Shared Resend transport for all PULSE email (auth + transactional).
// Replaces the Lovable email gateway. Reads RESEND_API_KEY from the function
// environment. Throws an Error with a numeric `.status` on failure so the
// queue processor's rate-limit (429) / forbidden (403) / DLQ handling works.

export interface ResendSendArgs {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** If provided, adds one-click List-Unsubscribe headers. */
  unsubscribeUrl?: string;
}

export async function sendViaResend(args: ResendSendArgs): Promise<{ id: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    const e = new Error("RESEND_API_KEY not configured") as Error & { status: number };
    e.status = 500;
    throw e;
  }

  const headers: Record<string, string> = {};
  if (args.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${args.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      reply_to: args.replyTo,
      headers: Object.keys(headers).length ? headers : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Resend send failed: ${res.status} ${body}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return await res.json();
}
