import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthState } from "@/hooks/useAuthState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { venueRpc } from "@/lib/venues/customerRecords";
import { renderVenueEmail, venueEmailWorkspace } from "@/lib/venues/email";
export function VenueEmailComposer({
  venueId,
  groupId,
  events,
}: {
  venueId: string;
  groupId: string;
  events: { id: string; title: string; start_time: string }[];
}) {
  const { user } = useAuthState();
  const q = useQuery({
    queryKey: ["venue-email", user?.id, venueId],
    enabled: !!user,
    queryFn: () => venueEmailWorkspace(venueId),
  });
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [event, setEvent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{
      count: number;
      fingerprint: string;
    } | null>(null),
    [request, setRequest] = useState(() => crypto.randomUUID());
  function changed() {
    setPreview(null);
    setNotice("");
    setRequest(crypto.randomUUID());
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send email.");
    } finally {
      setBusy(false);
    }
  }
  const ready = q.data?.eligible && q.data.connection?.enabled;
  const rendered = q.data
    ? renderVenueEmail(q.data.brand, {
        subject: subject || "Your subject",
        body: body || "Write your venue update to preview it here.",
        footer: q.data.connection?.footer,
        venueUrl: `https://pulsepb.com/player/community/group/${groupId}`,
        unsubscribeUrl: "https://pulsepb.com/venue-email-preferences-preview",
      })
    : null;
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Send a branded email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates for players who chose email from your venue.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link
            to={`/player/community/group/${groupId}/manage?tab=integrations`}
          >
            Email setup
          </Link>
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {q.isPending ? (
        <p role="status">Loading email connection…</p>
      ) : q.isError ? (
        <div role="alert">
          <p>We couldn’t check your email connection.</p>
          <Button variant="outline" onClick={() => void q.refetch()}>
            Retry email connection
          </Button>
        </div>
      ) : !ready ? (
        <p className="rounded-xl bg-muted/40 p-4 text-sm">
          Connect a sender, send a test, and enable venue email in Integrations
          to get started.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () =>
              setPreview(
                await venueRpc("venue_email_preview", {
                  p_venue: venueId,
                  p_event: event || null,
                }),
              ),
            );
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm">
              Email audience
              <select
                value={event}
                onChange={(e) => {
                  setEvent(e.target.value);
                  changed();
                }}
                className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">Subscribed community players</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    Event subscribers · {e.title} ·{" "}
                    {new Date(e.start_time).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Email subject
              <Input
                required
                maxLength={120}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  changed();
                }}
              />
            </label>
            <label className="block text-sm">
              Email message
              <Textarea
                required
                maxLength={10000}
                rows={6}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  changed();
                }}
              />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Only subscribed players with confirmed account emails are
              included. Global email preferences, venue muting, and unsubscribe
              requests apply. Each player gets an individual message. Up to 500
              recipients per update and 1,000 per venue in 24 hours.
            </p>
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Preview this email
              </summary>
              {rendered && (
                <iframe
                  title="Venue message preview"
                  sandbox=""
                  srcDoc={rendered.html}
                  className="mt-3 h-[620px] w-full rounded-lg border bg-white"
                />
              )}
            </details>
            <Button type="submit" variant="outline">
              Review recipients
            </Button>
            {preview && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">
                  {preview.count} subscribed{" "}
                  {preview.count === 1 ? "player" : "players"} will receive “
                  {subject}”.
                </p>
                {preview.count === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Players can opt in under Notifications on your venue page.
                    No email will be sent to unsubscribed players.
                  </p>
                ) : (
                  <Button
                    type="button"
                    disabled={preview.count > 500}
                    onClick={() =>
                      void act(async () => {
                        await venueRpc("venue_email_campaign_send", {
                          p_venue: venueId,
                          p_event: event || null,
                          p_subject: subject,
                          p_body: body,
                          p_fingerprint: preview.fingerprint,
                          p_request: request,
                        });
                        setSubject("");
                        setBody("");
                        setPreview(null);
                        setRequest(crypto.randomUUID());
                        setNotice(
                          "Email queued. Delivery activity will update as the provider accepts messages.",
                        );
                        await q.refetch();
                      })
                    }
                  >
                    Send email to {preview.count}{" "}
                    {preview.count === 1 ? "player" : "players"}
                  </Button>
                )}
              </div>
            )}
          </fieldset>
        </form>
      )}
      {!!q.data?.campaigns.length && (
        <div className="border-t pt-4">
          <h3 className="font-medium">Recent email updates</h3>
          <ul className="divide-y">
            {q.data.campaigns.slice(0, 5).map((c) => (
              <li className="py-3 text-sm" key={c.id}>
                <p className="font-medium">{c.subject}</p>
                <p className="text-muted-foreground">
                  {c.accepted} of {c.recipient_count} accepted by provider
                  {c.needs_attention
                    ? ` · ${c.needs_attention} need attention`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => void q.refetch()}>
            Refresh delivery counts
          </Button>
        </div>
      )}
    </section>
  );
}
