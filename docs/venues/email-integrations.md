# Venue email integrations

Venue owners and active managers configure email in **Settings → Integrations → Branded venue email**. The venue must be active and ownership-verified. Setup never activates sending automatically.

## Delivery options

- **PULSE-managed:** uses the platform's existing `RESEND_API_KEY` and verified `support@pulsepb.com` sender. The display name is “Venue name via PULSE”; replies go to the venue's chosen inbox. A successful test is required even when this option is selected.
- **Resend:** a sending API key scoped to the venue's verified domain. [Provider setup](https://resend.com/docs/dashboard/domains/introduction), [send API](https://resend.com/docs/api-reference/emails/send-email).
- **SendGrid:** an API key with Mail Send permission and a verified sender. The adapter uses the global SendGrid endpoint. [Sender identity](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sender-identity), [send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).
- **Postmark:** a Server API token, verified sender, and active Broadcast stream. A Transactional stream cannot be used for venue updates. Keep Postmark unsubscribe handling enabled. [Sender setup](https://postmarkapp.com/developer/user-guide/managing-your-account/managing-sender-signatures), [streams API](https://postmarkapp.com/developer/api/message-streams-api), [send API](https://postmarkapp.com/developer/api/email-api).

Existing Google Workspace, Microsoft 365, and other mailboxes can receive replies. This release does not connect their mail-sending OAuth APIs or SMTP servers. API provider credentials are entered in the venue UI, never in chat. Venue email is outbound only; replies stay in the configured inbox.

## Venue workflow

1. Choose a provider and sender name, sender address, reply-to inbox and optional sign-off.
2. Save. Credentials are stored in Supabase Vault; the browser receives only redacted configuration. [Vault documentation](https://supabase.com/docs/guides/database/vault).
3. Preview the template. Venue name, logo, accent color and address come from the existing venue profile.
4. Send a test to the manager's own confirmed PULSE account address. No arbitrary test recipient is accepted. Check inbox/spam and sender details. A provider acceptance does not prove inbox delivery.
5. Enable venue email. Changing sender settings or credentials invalidates the test and pauses sending.
6. In **Communications**, write an email, choose subscribed community players or event registrants, preview the audience and content, then send. Each recipient gets an individual email.

Players opt in under the venue's **Notifications → Venue email updates**. This preference starts off. Emails require an active venue community membership and a confirmed account email. Existing global email opt-outs, venue muting, suppression records and unsubscribe requests remain effective. Guest contact records are not imported as email subscribers. Authentication, payment and existing platform transactional emails are unchanged.

## Delivery infrastructure

- `venue-email`: authenticated connection/save/test/disconnect endpoint; current user, MFA and venue authority are checked before service operations.
- `venue-email-delivery`: server-only worker called each minute using the existing database-generated scheduler secret.
- `venue-email-unsubscribe`: token-specific preference update. GET displays a confirmation; POST performs the update, including one-click email-client requests.
- Four private tables: connections, preferences, campaigns and outbox. Raw tables and credential RPCs are closed to browser roles. All management reads and writes check venue authority.
- Preview fingerprints detect audience changes; campaign request IDs deduplicate retries. Consent and venue authorization are checked again before dispatch.
- Outbox leases fence workers. Explicit provider rate limits retry up to five attempts. Uncertain network/server outcomes become **Check provider activity** and are not automatically resent. Resend requests additionally use a stable idempotency key.
- Pending work expires after 24 hours; pausing retains queued work until resumed or expired. Disconnecting or changing sender settings cancels queued work. An already in-flight email may complete.
- Initial limits: 500 recipients per campaign, 1,000 queued recipients per venue per rolling day, five setup tests per hour. These are enforced in the database.
- Delivery status is **accepted by provider**, not “delivered.” Inbox placement, provider bounces, complaints, and provider-managed unsubscribe events remain visible in the connected provider. No open/click tracking is enabled by the adapters. Provider webhook ingestion and mailbox OAuth are separate extensions.

## Operations and verification

Deploy both migrations and all three Edge Functions together. The scheduler relies on `private.app_config.edge_functions_base_url` and `scheduled_task_secret`, already provisioned for PULSE scheduled jobs. Managed sending relies on the existing server `RESEND_API_KEY`; external provider keys are venue-specific Vault secrets. No new secrets are needed for custom providers beyond the UI connection.

Run `tests/venues/email-integrations.test.ts`, `email-delivery.test.ts`, and `email-ui.test.tsx`, plus existing communications/integrations tests. SQL tests exercise the actual migration with a test-only Vault stand-in. Never use live recipient lists to test delivery. Production smoke checks should confirm anonymous denial and migration/function presence without queuing any email.
