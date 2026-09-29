import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VenueEmailComposer } from "@/components/venue/VenueEmailComposer";
type Settings = {
  waitlist_offers: boolean;
  offer_minutes: number;
  event_reminders: boolean;
  reminder_hours: number;
  arrival_instructions: string;
  updated_at: string | null;
};
type Workspace = {
  settings: Settings | null;
  events: { id: string; title: string; start_time: string }[];
  messages: {
    id: string;
    title: string;
    body: string;
    audience: string;
    recipient_count: number;
    created_at: string;
  }[];
  offers: { id: string; title: string; status: string; expires_at: string }[];
};
const defaults: Settings = {
  waitlist_offers: false,
  offer_minutes: 120,
  event_reminders: false,
  reminder_hours: 24,
  arrival_instructions: "",
  updated_at: null,
};
const audiences = {
  community: "Active community members",
  event: "Event registrants and waitlist",
  memberships: "Active paid memberships",
  no_shows: "No-shows in the last 30 days",
};
export default function VenueCommunications() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const venue = group?.venue_id;
  const tz = group?.venue?.timezone || "America/New_York";
  const q = useQuery({
    queryKey: ["venue-communications", venue, user?.id],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<Workspace>("venue_communications_workspace", { p_venue: venue }),
  });
  const [settings, setSettings] = useState(defaults),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [audience, setAudience] = useState("community"),
    [event, setEvent] = useState(""),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [preview, setPreview] = useState<number | null>(null),
    [request, setRequest] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (q.data) setSettings(q.data.settings || defaults);
  }, [q.data]);
  useEffect(() => {
    setPreview(null);
    setRequest(crypto.randomUUID());
  }, [audience, event, title, body]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {group?.venue?.name || group?.name}
        </p>
        <h1 className="text-2xl font-bold">Communications & automation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep players informed before their next visit.
        </p>
      </header>
      {(error || q.error) && (
        <p role="alert" className="text-destructive">
          {error || q.error?.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {q.isPending ? (
        <p>Loading communications…</p>
      ) : (
        q.data && (
          <>
            <VenueEmailComposer venueId={venue!} groupId={groupId} events={q.data.events} />
            <form
              className="space-y-4 rounded-2xl border bg-card p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await rpc("venue_automation_settings_save", {
                    p_venue: venue,
                    p_expected: settings.updated_at,
                    p_document: settings,
                  });
                  await q.refetch();
                  setNotice("Automation settings saved.");
                });
              }}
            >
              <h2 className="text-lg font-semibold">Before players arrive</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.waitlist_offers}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        waitlist_offers: e.target.checked,
                      })
                    }
                  />
                  Timed waitlist offers
                </label>
                <label className="text-sm">
                  Time to claim a place (minutes)
                  <Input
                    type="number"
                    min={35}
                    max={1440}
                    required
                    value={settings.offer_minutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        offer_minutes: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.event_reminders}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        event_reminders: e.target.checked,
                      })
                    }
                  />
                  Automatic in-app reminders
                </label>
                <label className="text-sm">
                  Hours before a program
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    required
                    value={settings.reminder_hours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        reminder_hours: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="block text-sm">
                Arrival instructions
                <Textarea
                  maxLength={2000}
                  value={settings.arrival_instructions}
                  placeholder="Where to park, what to bring, and where to check in"
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      arrival_instructions: e.target.value,
                    })
                  }
                />
              </label>
              <p className="text-sm text-muted-foreground">
                Reminders go to confirmed PULSE players and follow their
                notification preferences. Guests without an account receive
                arrival instructions from your desk. Paid waitlist offers
                require checkout; free offers require acceptance. When timed
                offers are off, the existing free-event promotion behavior
                continues.
              </p>
              <Button disabled={busy}>Save automation</Button>
            </form>
            <form
              className="space-y-4 rounded-2xl border bg-card p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  setPreview(
                    await rpc<number>("venue_message_preview", {
                      p_venue: venue,
                      p_audience: audience,
                      p_event: audience === "event" ? event : null,
                    })
                  );
                });
              }}
            >
              <h2 className="text-lg font-semibold">Send an in-app message</h2>
              <label className="block text-sm">
                Audience
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  {Object.entries(audiences).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {audience === "event" && (
                <label className="block text-sm">
                  Event
                  <select
                    required
                    className="mt-1 w-full rounded-md border bg-background p-2"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                  >
                    <option value="">Choose event</option>
                    {q.data.events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} · {venueDate(e.start_time, tz)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                Title
                <Input
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Message
                <Textarea
                  required
                  maxLength={2000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <Button variant="outline" disabled={busy}>
                Preview audience
              </Button>
              {preview !== null && (
                <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                  <p className="text-sm">
                    {preview} eligible PULSE recipient{preview === 1 ? "" : "s"}
                    . Muted notifications, guests without accounts, and your own
                    account are excluded. This sends an in-app notification.
                  </p>
                  <p className="font-semibold">{title}</p>
                  <p className="whitespace-pre-wrap text-sm">{body}</p>
                  <Button
                    type="button"
                    disabled={busy || preview === 0}
                    onClick={() =>
                      void act(async () => {
                        await rpc("venue_message_send", {
                          p_venue: venue,
                          p_audience: audience,
                          p_event: audience === "event" ? event : null,
                          p_title: title,
                          p_body: body,
                          p_expected: preview,
                          p_request: request,
                        });
                        setTitle("");
                        setBody("");
                        setPreview(null);
                        await q.refetch();
                        setNotice("Message submitted to the selected players.");
                      })
                    }
                  >
                    Send to {preview} players
                  </Button>
                </div>
              )}
            </form>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Open waitlist offers</h2>
              {q.data.offers.length ? (
                <ul className="divide-y">
                  {q.data.offers.map((o) => (
                    <li key={o.id} className="py-3 text-sm">
                      <strong>{o.title}</strong>
                      <p>
                        {o.status === "checkout"
                          ? "Checkout in progress"
                          : `Claim by ${venueDate(o.expires_at, tz)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No outstanding offers.
                </p>
              )}
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Recent messages</h2>
              {q.data.messages.length ? (
                <ul className="divide-y">
                  {q.data.messages.map((m) => (
                    <li className="py-3" key={m.id}>
                      <p className="font-medium">{m.title}</p>
                      <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.recipient_count} recipients ·{" "}
                        {venueDate(m.created_at, tz)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your sent messages will appear here.
                </p>
              )}
            </section>
          </>
        )
      )}
    </main>
  );
}
