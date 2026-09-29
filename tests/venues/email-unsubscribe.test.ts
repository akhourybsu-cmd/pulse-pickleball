import { it, expect, vi } from "vitest";
import { createVenueUnsubscribeHandler } from "../../supabase/functions/venue-email-unsubscribe/handler";
const token = "81000000-0000-4000-8000-000000000005";
const url = "https://project.supabase.co/functions/v1/venue-email-unsubscribe";
it("redirects browser GETs to a confirmation without updating preferences", async () => {
  const save = vi.fn();
  const r = await createVenueUnsubscribeHandler(save)(
    new Request(`${url}?token=${token}`),
  );
  expect(r.status).toBe(303);
  expect(r.headers.get("location")).toBe(
    `https://pulsepb.com/venue-email/unsubscribe?token=${token}`,
  );
  expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  expect(save).not.toHaveBeenCalled();
});
it.each(["one-click", "web-app"])(
  "accepts explicit %s unsubscribe and returns API JSON",
  async (kind) => {
    const save = vi.fn().mockResolvedValue(true);
    const request =
      kind === "one-click"
        ? new Request(`${url}?token=${token}`, {
            method: "POST",
            body: "List-Unsubscribe=One-Click",
          })
        : new Request(url, { method: "POST", body: JSON.stringify({ token }) });
    const r = await createVenueUnsubscribeHandler(save)(request);
    expect(await r.json()).toEqual({ success: true });
    expect(save).toHaveBeenCalledExactlyOnceWith(token);
    expect(r.headers.get("content-type")).toBe("application/json");
  },
);
it("rejects malformed links and redacts database failures", async () => {
  const save = vi.fn().mockRejectedValue(new Error("private raw error"));
  const handler = createVenueUnsubscribeHandler(save);
  expect(
    (
      await handler(
        new Request(url, {
          method: "POST",
          body: JSON.stringify({ token: { bad: true } }),
        }),
      )
    ).status,
  ).toBe(400);
  expect(save).not.toHaveBeenCalled();
  const r = await handler(
    new Request(`${url}?token=${token}`, { method: "POST" }),
  );
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("private raw error");
});
