import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Mail, CheckCircle2 } from "lucide-react";
import { useAuthState } from "@/hooks/useAuthState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { venueRpc } from "@/lib/venues/customerRecords";
import {
  EMAIL_PROVIDERS,
  DELIVERY_LABELS,
  renderVenueEmail,
  venueEmailAction,
  venueEmailWorkspace,
  type VenueEmailWorkspace,
  type VenueEmailSettings,
  type VenueEmailProvider,
} from "@/lib/venues/email";

export function VenueEmailIntegration({
  venueId,
  groupId,
}: {
  venueId: string;
  groupId: string;
}) {
  const { user } = useAuthState();
  const q = useQuery({
    queryKey: ["venue-email", user?.id, venueId],
    enabled: !!user,
    queryFn: () => venueEmailWorkspace(venueId),
    refetchInterval: (query) =>
      query.state.data?.deliveries.some(
        (d) => d.kind === "test" && ["queued", "sending"].includes(d.status),
      )
        ? 3000
        : false,
  });
  return (
    <section
      className="min-w-0 space-y-5 rounded-2xl border bg-card p-5 [overflow-wrap:anywhere] sm:p-6"
      aria-labelledby="venue-email-title"
    >
      <div className="flex gap-3">
        <span className="h-fit rounded-xl bg-primary/10 p-3">
          <Mail className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h2 id="venue-email-title" className="font-semibold">
            Branded venue email
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your name, your colors, your community. Choose how your emails are
            delivered.
          </p>
        </div>
      </div>
      {q.isPending ? (
        <p role="status">Loading email setup…</p>
      ) : q.isError ? (
        <div role="alert">
          <p>We couldn’t load your email settings.</p>
          <Button variant="outline" onClick={() => void q.refetch()}>
            Retry email setup
          </Button>
        </div>
      ) : (
        <VenueEmailSetup
          key={`${venueId}:${q.data.connection?.version || "new"}`}
          venueId={venueId}
          groupId={groupId}
          workspace={q.data}
          refresh={async () => {
            await q.refetch();
          }}
        />
      )}
    </section>
  );
}
export function VenueEmailSetup({
  venueId,
  groupId,
  workspace: w,
  refresh,
}: {
  venueId: string;
  groupId: string;
  workspace: VenueEmailWorkspace;
  refresh: () => Promise<void>;
}) {
  const c = w.connection;
  const initial: VenueEmailSettings = c
    ? {
        provider: c.provider,
        sender_name: c.sender_name,
        from_email: c.from_email,
        reply_to: c.reply_to,
        footer: c.footer,
        message_stream: c.message_stream,
      }
    : {
        provider: "pulse",
        sender_name: w.brand.name,
        from_email: "support@pulsepb.com",
        reply_to: "",
        footer: "",
        message_stream: "broadcasts",
      };
  const [form, setForm] = useState(initial),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || !!key;
  const provider = EMAIL_PROVIDERS.find((p) => p.id === form.provider)!;
  const preview = renderVenueEmail(w.brand, {
    subject: "Your next visit starts here",
    body: "Bring your game. We’ll take care of the rest.\n\nYour venue updates, upcoming sessions, and community news will carry this branding.",
    footer: form.footer,
    venueUrl: `https://pulsepb.com/player/community/group/${groupId}`,
  });
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update email settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  const change = (field: keyof VenueEmailSettings, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));
  return (
    <div className="space-y-6">
      <ol
        aria-label="Email setup progress"
        className="grid gap-2 text-sm sm:grid-cols-3"
      >
        {[
          [!!c, "1. Choose a sender"],
          [!!c?.tested_at, "2. Send a test"],
          [!!c?.enabled, "3. Enable email"],
        ].map(([done, label]) => (
          <li
            key={String(label)}
            className={`flex items-center gap-2 rounded-xl border p-3 ${done ? "bg-primary/5" : ""}`}
          >
            {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
            {label}
          </li>
        ))}
      </ol>
      {!w.eligible && (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm">
          Email setup is available to owners and managers of active, verified
          venues. Complete venue verification before connecting a sender.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await venueEmailAction({
              venueId,
              action: "save",
              expected: c?.version || null,
              document: form,
              key: key || undefined,
            });
            setKey("");
            setNotice("Sender saved. Send a test before enabling email.");
          });
        }}
      >
        <fieldset disabled={busy || !w.eligible} className="space-y-5">
          <legend className="mb-3 text-sm font-semibold">
            Choose your delivery option
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {EMAIL_PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer rounded-xl border p-4 ${form.provider === p.id ? "border-primary bg-primary/5" : "bg-background"}`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="venue-email-provider"
                    value={p.id}
                    checked={form.provider === p.id}
                    onChange={() => {
                      setKey("");
                      setForm((f) => ({
                        ...f,
                        provider: p.id as VenueEmailProvider,
                        from_email:
                          p.id === "pulse"
                            ? "support@pulsepb.com"
                            : c?.provider === p.id
                              ? c.from_email
                              : "",
                      }));
                    }}
                  />
                  {p.name}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {p.description}
                </span>
              </label>
            ))}
          </div>
          <div className="rounded-xl bg-muted/50 p-4 text-sm leading-6">
            <p>{provider.help}</p>
            {provider.url && (
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block underline"
              >
                Open {provider.name} setup guide ↗
              </a>
            )}
            <p className="mt-2 text-muted-foreground">
              Using Gmail or Microsoft 365? Keep that inbox as your reply-to
              address. Your mailbox password is never needed.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Sender name
              <Input
                required
                maxLength={100}
                value={form.sender_name}
                onChange={(e) => change("sender_name", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Reply-to inbox
              <Input
                type="email"
                required
                maxLength={254}
                value={form.reply_to}
                placeholder="hello@yourvenue.com"
                onChange={(e) => change("reply_to", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              From email
              <Input
                type="email"
                required
                disabled={form.provider === "pulse"}
                maxLength={254}
                value={form.from_email}
                onChange={(e) => change("from_email", e.target.value)}
              />
            </label>
            {form.provider !== "pulse" && (
              <label className="block text-sm">
                {form.provider === "postmark"
                  ? "Server API token"
                  : "Sending API key"}
                <Input
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  maxLength={1000}
                  required={!c || c.provider !== form.provider}
                  value={key}
                  placeholder={
                    c?.provider === form.provider
                      ? "Saved securely · enter only to replace"
                      : ""
                  }
                  onChange={(e) => setKey(e.target.value)}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Encrypted when saved. Your key is never shown again.
                </span>
              </label>
            )}
            {form.provider === "postmark" && (
              <label className="block text-sm">
                Broadcast stream ID
                <Input
                  required
                  maxLength={100}
                  value={form.message_stream}
                  onChange={(e) => change("message_stream", e.target.value)}
                />
              </label>
            )}
          </div>
          <label className="block text-sm">
            Email sign-off
            <Textarea
              maxLength={500}
              value={form.footer}
              placeholder={`See you on the courts,\n${w.brand.name}`}
              onChange={(e) => change("footer", e.target.value)}
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            Logo, accent color, venue name, and mailing address come from your
            venue profile. Saving sender changes pauses email until you send
            another successful test. Provider usage charges may apply to your
            connected account.
          </p>
          <Button disabled={busy || (!dirty && !!c)} className="min-h-11">
            {busy ? "Working…" : "Save sender settings"}
          </Button>
        </fieldset>
      </form>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">
          Preview your branded email
        </summary>
        <p className="my-3 text-xs text-muted-foreground">
          Example content for preview only. Messages use your saved venue
          branding.
        </p>
        <iframe
          title="Branded venue email preview"
          sandbox=""
          srcDoc={preview.html}
          className="h-[620px] w-full rounded-lg border bg-white"
        />
      </details>
      {c && (
        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="font-semibold">Test and activate</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Send a test to your signed-in account
            {w.test_email ? ` (${w.test_email})` : ""}. Check your inbox and
            spam folder, then enable email when the branding and sender look
            right.
          </p>
          {dirty && (
            <p className="text-sm">
              Save your changes before testing or activating.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy || dirty || !w.eligible || !w.test_email}
              onClick={() =>
                void act(async () => {
                  await venueEmailAction({
                    venueId,
                    action: "test",
                    expected: c.version,
                    requestId: crypto.randomUUID(),
                  });
                  setNotice(
                    "Test submitted. Check its status below and look in your inbox.",
                  );
                })
              }
            >
              Send test to me
            </Button>
            <Button
              disabled={
                busy || dirty || (!c.enabled && (!c.tested_at || !w.eligible))
              }
              onClick={() =>
                void act(async () => {
                  await venueRpc("venue_email_toggle", {
                    p_venue: venueId,
                    p_expected: c.version,
                    p_enabled: !c.enabled,
                  });
                  setNotice(
                    c.enabled
                      ? "Email paused. Queued messages will wait."
                      : "Venue email enabled. You can compose an update in Communications.",
                  );
                })
              }
            >
              {c.enabled ? "Pause email" : "Enable venue email"}
            </Button>
            <Button variant="ghost" onClick={() => void refresh()}>
              Refresh status
            </Button>
          </div>
          <p className="text-sm font-medium">
            {c.enabled
              ? "Email is enabled"
              : c.tested_at
                ? "Test accepted · email is paused"
                : "A successful test is required"}
          </p>
          <p className="text-xs text-muted-foreground">
            “Accepted” means your provider accepted the message; it does not
            confirm inbox delivery. Check detailed delivery and bounce activity
            in your provider. Pausing stops queued messages; an email already
            being handed off may still send.
          </p>
          {c.enabled && (
            <Button asChild variant="outline">
              <Link to={`/player/community/group/${groupId}/communications`}>
                Compose an email
              </Link>
            </Button>
          )}
          {!confirmDisconnect ? (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setConfirmDisconnect(true)}
            >
              Disconnect provider
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p>
                Remove the saved credential and cancel queued email? Your
                delivery history stays available.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await venueEmailAction({
                        venueId,
                        action: "disconnect",
                        expected: c.version,
                      });
                      setConfirmDisconnect(false);
                    })
                  }
                >
                  Disconnect email
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Keep connection
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <section>
        <h3 className="font-semibold">Recent email activity</h3>
        {w.deliveries.length ? (
          <ul className="mt-2 divide-y">
            {w.deliveries.slice(0, 10).map((d) => (
              <li key={d.id} className="py-3 text-sm">
                <p className="font-medium break-words">
                  {d.kind === "test" ? "Setup test" : d.subject}
                </p>
                <p className="text-muted-foreground">
                  {DELIVERY_LABELS[d.status] || d.status} ·{" "}
                  {new Date(d.created_at).toLocaleString()}
                </p>
                {d.last_error && (
                  <p className="mt-1 text-destructive">{d.last_error}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Your tests and sent emails will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
