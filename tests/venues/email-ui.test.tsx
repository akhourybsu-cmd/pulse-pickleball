import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi } from "vitest";
import { VenueEmailSetup } from "@/components/venue/VenueEmailIntegration";
import type { VenueEmailWorkspace } from "@/lib/venues/email";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const w: VenueEmailWorkspace = {
  eligible: true,
  brand: {
    name: "Rally Haus",
    primary_color: "#A9CF46",
    address: "123 Court St",
  },
  test_email: "manager@example.test",
  connection: null,
  deliveries: [],
  campaigns: [],
};
const render = (workspace: VenueEmailWorkspace) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <VenueEmailSetup
        venueId="venue"
        groupId="group"
        workspace={workspace}
        refresh={async () => {}}
      />
    </MemoryRouter>,
  );
it("offers four real options and inherits venue branding with a sandboxed preview", () => {
  const html = render(w);
  for (const name of [
    "PULSE-managed",
    "Resend",
    "SendGrid",
    "Postmark",
    "Reply-to inbox",
    "Save sender settings",
    "Rally Haus",
    "Preview your branded email",
  ])
    expect(html).toContain(name);
  expect(html).toContain('sandbox=""');
  expect(html).toContain("mailbox password is never needed");
  expect(html).not.toContain("Send test to me");
});
it("requires a saved successful test before activating and never claims inbox delivery", () => {
  const c = {
    provider: "resend" as const,
    sender_name: "Rally Haus",
    from_email: "hello@venue.test",
    reply_to: "desk@venue.test",
    footer: "",
    message_stream: "broadcasts",
    version: "version",
    enabled: false,
    tested_at: null,
    updated_at: "2026-09-29T00:00:00Z",
  };
  const html = render({ ...w, connection: c });
  expect(html).toContain("Send test to me");
  expect(html).toContain("manager@example.test");
  expect(html).toMatch(/disabled=""[^>]*>Enable venue email/);
  expect(html).toContain("does not confirm inbox delivery");
  expect(html).toContain("Saved securely");
});
