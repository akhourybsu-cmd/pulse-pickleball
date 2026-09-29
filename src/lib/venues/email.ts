import { supabase } from "@/integrations/supabase/client";
import { venueRpc } from "./customerRecords";
export { renderVenueEmail } from "../../../supabase/functions/_shared/venue-email-template";
export type { VenueEmailBrand } from "../../../supabase/functions/_shared/venue-email-template";
import type { VenueEmailBrand } from "../../../supabase/functions/_shared/venue-email-template";
export type VenueEmailProvider = "pulse" | "resend" | "sendgrid" | "postmark";
export const EMAIL_PROVIDERS = [
  {
    id: "pulse",
    name: "PULSE-managed",
    description:
      "Use your venue branding with PULSE delivery. No provider account or DNS setup needed.",
    help: "Your venue name appears with “via PULSE”. Replies go to your existing inbox, including Google Workspace or Microsoft 365.",
    url: null,
  },
  {
    id: "resend",
    name: "Resend",
    description:
      "Connect your Resend account and send from your verified venue domain.",
    help: "Verify your sending domain in Resend, then create a Sending access API key scoped to that domain.",
    url: "https://resend.com/docs/dashboard/domains/introduction",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Use an existing SendGrid account and authenticated sender.",
    help: "Authenticate your domain or verify your sender in SendGrid. Create an API key with Mail Send permission.",
    url: "https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sender-identity",
  },
  {
    id: "postmark",
    name: "Postmark",
    description: "Connect a Postmark server and its Broadcast message stream.",
    help: "Verify your sender/domain, copy your Server API token, and enter a Broadcast stream ID. Keep unsubscribe handling enabled in Postmark.",
    url: "https://postmarkapp.com/developer/user-guide/managing-your-account/managing-sender-signatures",
  },
] as const;
export interface VenueEmailSettings {
  provider: VenueEmailProvider;
  sender_name: string;
  from_email: string;
  reply_to: string;
  footer: string;
  message_stream: string;
}
export interface VenueEmailConnection extends VenueEmailSettings {
  version: string;
  enabled: boolean;
  tested_at: string | null;
  updated_at: string;
}
export interface VenueEmailWorkspace {
  eligible: boolean;
  brand: VenueEmailBrand;
  connection: VenueEmailConnection | null;
  test_email: string | null;
  deliveries: {
    id: string;
    kind: string;
    subject: string;
    status: string;
    last_error: string | null;
    created_at: string;
  }[];
  campaigns: {
    id: string;
    subject: string;
    recipient_count: number;
    accepted: number;
    needs_attention: number;
    created_at: string;
  }[];
}
export const venueEmailWorkspace = (venue: string) =>
  venueRpc<VenueEmailWorkspace>("venue_email_workspace", { p_venue: venue });
export async function venueEmailAction(body: {
  venueId: string;
  action: "save" | "test" | "disconnect";
  expected: string | null;
  document?: VenueEmailSettings;
  key?: string;
  requestId?: string;
}) {
  const { data, error } = await supabase.functions.invoke("venue-email", {
    body,
  });
  if (error?.context instanceof Response) {
    const detail = await error.context.json().catch(() => null);
    if (typeof detail?.error === "string" && detail.error.length <= 400)
      throw new Error(detail.error);
  }
  if (error || data?.error)
    throw new Error(
      data?.error ||
        "Email setup could not be completed. Check your connection, venue access, and saved settings, then retry.",
    );
  return data;
}
export const DELIVERY_LABELS: Record<string, string> = {
  queued: "Queued",
  sending: "Sending",
  accepted: "Accepted by provider",
  failed: "Needs attention",
  unknown: "Check provider activity",
  canceled: "Canceled",
  suppressed: "Not sent · preferences",
};
