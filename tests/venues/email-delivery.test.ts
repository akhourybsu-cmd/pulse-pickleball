import { describe, it, expect, vi } from "vitest";
import {
  deliverVenueEmail,
  type EmailEnvelope,
} from "../../supabase/functions/venue-email/providers";
import { renderVenueEmail } from "../../supabase/functions/_shared/venue-email-template";
import {
  createVenueEmailHandler,
  safeSetupError,
} from "../../supabase/functions/venue-email/handler";
import { processVenueEmail } from "../../supabase/functions/venue-email/worker";
const envelope: EmailEnvelope = {
  id: "message-1",
  provider: "resend",
  key: "secret-never-output",
  from: "hello@venue.test",
  name: "Venue",
  replyTo: "desk@venue.test",
  to: "player@example.test",
  subject: "Come play",
  html: "<p>Come play</p>",
  text: "Come play",
  unsubscribeUrl: "https://pulsepb.com/unsubscribe?token=example",
  stream: "broadcasts",
};
describe("provider adapters", () => {
  it.each(["pulse", "resend", "sendgrid", "postmark"] as const)(
    "sends an individual branded message with %s",
    async (provider) => {
      const request = vi.fn().mockImplementation(async (url: string) =>
        url.includes("/message-streams/")
          ? Response.json({
              MessageStreamType: "Broadcasts",
              ArchivedAt: null,
            })
          : provider === "sendgrid"
            ? new Response(null, {
                status: 202,
                headers: { "x-message-id": "provider-id" },
              })
            : Response.json(
                provider === "postmark"
                  ? { ErrorCode: 0, MessageID: "provider-id" }
                  : { id: "provider-id" },
              ),
      );
      expect(
        await deliverVenueEmail({ ...envelope, provider }, request),
      ).toEqual({ status: "accepted", providerId: "provider-id" });
      const call = request.mock.calls.at(-1)!;
      const body = JSON.parse(call[1].body);
      expect(call[1].redirect).toBe("error");
      expect(JSON.stringify(body)).toContain("desk@venue.test");
      expect(JSON.stringify(body)).toContain("List-Unsubscribe");
      expect(JSON.stringify(body)).not.toContain(envelope.key);
      if (provider === "resend" || provider === "pulse")
        expect(call[1].headers["Idempotency-Key"]).toBe(
          "venue-email/message-1",
        );
      if (provider === "postmark")
        expect(body.MessageStream).toBe("broadcasts");
    },
  );
  it("retries only explicit rate limits, and redacts raw provider failures", async () => {
    expect(
      (
        await deliverVenueEmail(
          envelope,
          vi
            .fn()
            .mockResolvedValue(
              new Response("secret raw value", { status: 429 }),
            ),
        )
      ).status,
    ).toBe("retry");
    for (const code of [400, 401, 403, 500]) {
      const result = await deliverVenueEmail(
        envelope,
        vi
          .fn()
          .mockResolvedValue(
            new Response("secret raw value", { status: code }),
          ),
      );
      expect(result.status).toBe(code === 500 ? "unknown" : "failed");
      expect(JSON.stringify(result)).not.toContain("secret raw value");
    }
    expect(
      (
        await deliverVenueEmail(
          envelope,
          vi.fn().mockRejectedValue(new Error("secret key in network error")),
        )
      ).status,
    ).toBe("unknown");
  });
  it("rejects transactional or archived Postmark streams before sending", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json({ MessageStreamType: "Transactional", ArchivedAt: null }),
      );
    expect(
      (await deliverVenueEmail({ ...envelope, provider: "postmark" }, request))
        .status,
    ).toBe("failed");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("blocks unsupported providers and header injection without network calls", async () => {
    const request = vi.fn();
    expect(
      (
        await deliverVenueEmail(
          { ...envelope, provider: "smtp" as any },
          request,
        )
      ).status,
    ).toBe("failed");
    expect(
      (
        await deliverVenueEmail(
          { ...envelope, name: "Venue\r\nBcc: hidden" },
          request,
        )
      ).status,
    ).toBe("failed");
    expect(request).not.toHaveBeenCalled();
  });
});
it("renders the same safe branding for preview and delivery without raw HTML injection", () => {
  const rendered = renderVenueEmail(
    {
      name: "<script>bad</script>",
      primary_color: "red;url(javascript:bad)",
      logo_url: "javascript:alert(1)",
      address: "123 Court St",
    },
    {
      subject: "<img onerror=x>",
      body: "A & B\n<script>bad</script>",
      footer: "See you soon",
      venueUrl: "javascript:alert(1)",
      unsubscribeUrl: "https://pulsepb.com/preferences",
    },
  );
  expect(rendered.html).not.toMatch(
    /<script>|onerror=x>|javascript:|background:red/,
  );
  expect(rendered.html).toContain("&lt;script&gt;");
  expect(rendered.html).toContain("123 Court St");
  expect(rendered.html).toContain("https://pulsepb.com/preferences");
  expect(rendered.text).toContain("A & B");
});
const venue = "81000000-0000-4000-8000-000000000005";
const request = (body: any) =>
  new Request("https://pulsepb.com/functions/v1/venue-email", {
    method: "POST",
    body: JSON.stringify(body),
  });
it("authorizes the requested venue before storing a key or queuing a test", async () => {
  const rpc = vi.fn(),
    process = vi.fn(),
    authorize = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
  const handler = createVenueEmailHandler({ rpc, process, authorize });
  const result = await handler(
    request({
      venueId: venue,
      action: "save",
      expected: null,
      document: { provider: "resend" },
      key: envelope.key,
    }),
  );
  expect(result.status).toBe(403);
  expect(authorize).toHaveBeenCalledWith(expect.any(Request), venue);
  expect(rpc).not.toHaveBeenCalled();
});
it("uses the verified actor and masks database error bodies", async () => {
  const rpc = vi.fn().mockRejectedValue(new Error("secret-never-output")),
    process = vi.fn();
  const handler = createVenueEmailHandler({
    rpc,
    process,
    authorize: async () => ({ actor: "verified-actor" }),
  });
  const result = await handler(
    request({
      venueId: venue,
      action: "save",
      expected: null,
      document: { provider: "resend" },
      key: envelope.key,
      actor: "attacker",
    }),
  );
  expect(await result.text()).not.toContain(envelope.key);
  expect(rpc.mock.calls[0][1].p_actor).toBe("verified-actor");
});
it("shows curated setup guidance without exposing unexpected database details", async () => {
  const safe = "Settings changed. Refresh before saving.";
  const rpc = vi
    .fn()
    .mockRejectedValueOnce(safeSetupError(safe))
    .mockRejectedValueOnce(safeSetupError("duplicate secret-never-output"));
  const handler = createVenueEmailHandler({
    rpc,
    process: vi.fn(),
    authorize: async () => ({ actor: "verified" }),
  });
  const body = {
    venueId: venue,
    action: "save",
    expected: null,
    document: { provider: "resend" },
  };
  expect(await (await handler(request(body))).json()).toEqual({ error: safe });
  expect(await (await handler(request(body))).text()).not.toContain(
    "secret-never-output",
  );
});
it("dispatches server-selected recipients and branded content, and finishes the exact lease", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({
      job: {
        id: "job",
        lease: "lease",
        kind: "announcement",
        subject: "Update",
        body: "Hello",
        brand: { name: "Venue" },
        footer: "Thanks",
        venue_url: "https://pulsepb.com",
        unsubscribe_token: "token",
        recipient_email: "server-selected@example.test",
      },
      connection: {
        provider: "resend",
        sender_name: "Venue",
        from_email: "sender@venue.test",
        reply_to: "reply@venue.test",
      },
      key: "protected-key",
    })
    .mockResolvedValue(null);
  const deliver = vi
    .fn()
    .mockResolvedValue({ status: "accepted", providerId: "accepted" });
  expect(
    await processVenueEmail(
      { rpc, deliver, baseUrl: "https://project.supabase.co" },
      "job",
      1,
    ),
  ).toEqual({ processed: 1 });
  expect(deliver.mock.calls[0][0]).toMatchObject({
    to: "server-selected@example.test",
    key: "protected-key",
    id: "job",
  });
  expect(deliver.mock.calls[0][0].html).toContain(
    "venue-email-unsubscribe?token=token",
  );
  expect(rpc.mock.calls[1]).toEqual([
    "venue_email_finish",
    {
      p_job: "job",
      p_lease: "lease",
      p_status: "accepted",
      p_provider_id: "accepted",
      p_error: null,
    },
  ]);
});
it("does not call a provider when managed delivery is unavailable", async () => {
  const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        job: {
          id: "job",
          lease: "lease",
          brand: { name: "Venue" },
          subject: "Test",
          body: "Test",
          venue_url: "https://pulsepb.com",
        },
        connection: { provider: "pulse" },
      })
      .mockResolvedValue(null),
    deliver = vi.fn();
  await processVenueEmail(
    { rpc, deliver, baseUrl: "https://project.supabase.co" },
    "job",
    1,
  );
  expect(deliver).not.toHaveBeenCalled();
  expect(rpc.mock.calls[1][1].p_status).toBe("failed");
});
