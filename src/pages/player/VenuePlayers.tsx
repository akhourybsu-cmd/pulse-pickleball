import { VenueAdminSubnav } from "@/components/venue/VenueAdminSubnav";
import { VenueAdminPageHeader } from "@/components/venue/VenueAdminPageHeader";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Search, UserRound, FileCheck2, Copy } from "lucide-react";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import {
  canManageVenue,
  useMyVenueRole,
} from "@/components/venue/VenueStaffContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  venueRpc as rpc,
  venueDate,
  type VenueCustomer,
  type VenueCustomerProfile,
  type VenueDocument,
} from "@/lib/venues/customerRecords";
import { formatMoney } from "@/lib/payments";

export default function VenuePlayers() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const role = useMyVenueRole(group?.venue_id);
  const manage =
    group?.venue?.owner_id === user?.id || canManageVenue(role.role);
  const venue = group?.venue_id;
  const timezone = group?.venue?.timezone || "America/New_York";
  const [params, setParams] = useSearchParams();
  const documents = params.get("tab") === "documents";
  const selected = params.get("player");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<VenueCustomer | true | null>(null);
  const [publishing, setPublishing] = useState<VenueDocument | true | null>(
    null,
  );
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const client = useQueryClient();
  const directory = useQuery({
    queryKey: ["venue-customers", venue, user?.id, search, page],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<{ players: VenueCustomer[] }>("venue_customer_directory", {
        p_venue: venue,
        p_search: search,
        p_page: page,
      }),
  });
  const profile = useQuery({
    queryKey: ["venue-customer", selected, user?.id],
    enabled: !!selected && !!user,
    queryFn: () =>
      rpc<VenueCustomerProfile>("venue_customer_profile", {
        p_customer: selected,
      }),
  });
  const docs = useQuery({
    queryKey: ["venue-documents", venue, user?.id],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<VenueDocument[]>("venue_documents_list", { p_venue: venue }),
  });
  async function act(fn: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await Promise.all(
        ["venue-customers", "venue-customer", "venue-documents"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setWorking(false);
    }
  }
  const p = profile.data;
  const rows = directory.data?.players.slice(0, 50) || [];
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <VenueAdminPageHeader
        title="Players & first visits"
        description="Player history, guest records and venue documents in one place."
      >
        <Button
          onClick={() => {
            setEditing(true);
            setError("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add guest
        </Button>
      </VenueAdminPageHeader>
      <VenueAdminSubnav
        label="Player management"
        value={documents ? "documents" : "players"}
        onChange={(value) =>
          setParams(value === "documents" ? { tab: "documents" } : {})
        }
        items={[
          { value: "players", label: "Players", icon: UserRound },
          {
            value: "documents",
            label: "Waivers & documents",
            icon: FileCheck2,
          },
        ]}
      />
      {(error || directory.error || docs.error || profile.error) && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {error || (directory.error || docs.error || profile.error)?.message}
          <Button
            variant="link"
            onClick={() => {
              void directory.refetch();
              void docs.refetch();
              if (selected) void profile.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {notice}
        </p>
      )}
      {documents ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Published venue documents
              </h2>
              <p className="text-sm text-muted-foreground">
                Each published version keeps its own signed acknowledgments.
                Required documents must be accepted before check-in.
              </p>
            </div>
            {manage && (
              <Button onClick={() => setPublishing(true)}>
                Publish document
              </Button>
            )}
          </div>
          {docs.isPending ? (
            <p role="status">Loading documents…</p>
          ) : !docs.data?.length ? (
            <Empty text="No venue documents published. Upload your approved wording to begin." />
          ) : (
            docs.data.map((d) => (
              <article key={d.id} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{d.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Version {d.version} ·{" "}
                      {d.retired_at
                        ? "Replaced"
                        : d.required
                          ? "Required"
                          : "Optional"}{" "}
                      · {venueDate(d.published_at, timezone)}
                    </p>
                  </div>
                  {manage && !d.retired_at && (
                    <Button variant="outline" onClick={() => setPublishing(d)}>
                      Publish replacement
                    </Button>
                  )}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Read wording
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                    {d.body}
                  </p>
                </details>
              </article>
            ))
          )}
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
          <section className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Search venue players</span>
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Name, email or phone"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            {directory.isPending ? (
              <p role="status">Loading players…</p>
            ) : rows.length === 0 ? (
              <Empty text="No players found. Add a guest or invite players to your venue community." />
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card">
                {rows.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected === c.id}
                    className={`block w-full border-b p-4 text-left last:border-0 ${
                      selected === c.id ? "bg-primary/10" : "hover:bg-muted/60"
                    }`}
                    onClick={() => {
                      setParams({ player: c.id });
                      setLink("");
                    }}
                  >
                    <span className="block font-semibold">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {c.user_id ? "PULSE player" : "Guest"}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={!page || directory.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs">Page {page + 1}</span>
              <Button
                variant="outline"
                disabled={
                  (directory.data?.players.length || 0) <= 50 ||
                  directory.isFetching
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </section>
          <section className="min-w-0 space-y-5">
            {!selected ? (
              <Empty text="Select a player to see their visit history and first-visit requirements." />
            ) : profile.isPending ? (
              <p role="status">Loading player record…</p>
            ) : p && !profile.isError ? (
              <>
                <article className="rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">
                        {p.player.first_name} {p.player.last_name}
                      </h2>
                      <p className="break-all text-sm text-muted-foreground">
                        {p.player.email || "No email recorded"}
                        {p.player.phone ? ` · ${p.player.phone}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(p.player)}
                    >
                      Edit contact
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      [
                        "Registrations",
                        p.registrations.length + (p.visits?.length || 0),
                      ],
                      [
                        "Checked in",
                        p.registrations.filter((r) => r.checked_in_at).length +
                          (p.visits?.filter((v) => v.checked_in_at).length ||
                            0),
                      ],
                      [
                        "No-shows",
                        p.registrations.filter((r) => r.no_show_at).length +
                          (p.visits?.filter((v) => v.no_show_at).length || 0),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-muted/50 p-3">
                        <strong className="block text-xl">{value}</strong>
                        <span className="text-xs text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Counts reflect up to 200 online registrations and 200 desk
                    visits.
                  </p>
                </article>
                <article className="rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">First-visit requirements</h3>
                    <Button
                      variant="outline"
                      disabled={working}
                      onClick={() =>
                        void act(async () => {
                          const token = await rpc<string>("venue_visit_link", {
                            p_customer: p.player.id,
                          });
                          setLink(
                            `${window.location.origin}/venue-visit/${token}`,
                          );
                        })
                      }
                    >
                      Create player signing link
                    </Button>
                  </div>
                  {p.documents.length ? (
                    p.documents.map((d) => (
                      <p key={d.id} className="mt-3 text-sm">
                        {d.title} · v{d.version}
                        <span
                          className={`ml-2 ${
                            d.accepted_at
                              ? "text-muted-foreground"
                              : "font-semibold"
                          }`}
                        >
                          {d.accepted_at
                            ? `Accepted ${venueDate(d.accepted_at, timezone)}`
                            : d.required
                              ? "Needs acknowledgment"
                              : "Optional"}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No active documents.
                    </p>
                  )}
                  {link && (
                    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border p-4">
                      <div className="rounded-lg bg-white p-3">
                        <QRCodeSVG value={link} size={140} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          Have the player scan and sign
                        </p>
                        <p className="mb-3 text-sm text-muted-foreground">
                          This private link expires in 24 hours. Creating
                          another link revokes this one.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(link)
                              .then(() => setNotice("Player link copied."))
                              .catch(() =>
                                setError(
                                  "Copy failed. Select and copy the link below.",
                                ),
                              )
                          }
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy link
                        </Button>
                        <p className="mt-2 break-all text-xs select-all">
                          {link}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
                <article className="rounded-2xl border bg-card p-5">
                  <h3 className="font-semibold">Private staff notes</h3>
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const note = String(new FormData(form).get("note") || "");
                      void act(async () => {
                        await rpc("venue_customer_note", {
                          p_customer: p.player.id,
                          p_body: note,
                        });
                        form.reset();
                      });
                    }}
                  >
                    <Textarea
                      name="note"
                      aria-label="Private staff note"
                      required
                      maxLength={4000}
                      placeholder="Add context for your venue team"
                    />
                    <Button type="submit" disabled={working}>
                      Save note
                    </Button>
                  </form>
                  {p.notes.map((n) => (
                    <div key={n.id} className="mt-4 border-t pt-3">
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {n.body}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {venueDate(n.created_at, timezone)}
                      </p>
                    </div>
                  ))}
                </article>
                <article className="rounded-2xl border bg-card p-5">
                  <h3 className="font-semibold">Events & attendance</h3>
                  {p.registrations.length ? (
                    p.registrations.map((r) => (
                      <div key={r.id} className="mt-3 border-t pt-3 text-sm">
                        <strong>{r.title}</strong>
                        <p>{venueDate(r.start_time, timezone)}</p>
                        <p className="text-muted-foreground">
                          {r.checked_in_at
                            ? "Checked in"
                            : r.no_show_at
                              ? "No-show"
                              : r.status.replace("_", " ")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No event registrations yet.
                    </p>
                  )}
                </article>
                <article className="rounded-2xl border bg-card p-5">
                  <h3 className="font-semibold">Front-desk visits & passes</h3>
                  {p.visits?.map((v) => (
                    <div key={v.id} className="mt-3 border-t pt-3 text-sm">
                      <strong>{v.title}</strong>
                      <p>{venueDate(v.start_time, timezone)}</p>
                      <p className="text-muted-foreground">
                        {v.status.replace(/_/g, " ")} / {v.method}
                      </p>
                    </div>
                  ))}
                  {p.entitlements?.map((e) => (
                    <p key={e.id} className="mt-3 text-sm">
                      {e.name}:{" "}
                      {e.revoked_at
                        ? "Revoked"
                        : new Date(e.expires_at) <= new Date()
                          ? "Expired"
                          : e.kind === "membership"
                            ? "Active"
                            : `${Number(e.remaining_units)} units remaining`}
                    </p>
                  ))}
                  <Link
                    className="mt-3 inline-block text-sm underline"
                    to={`/player/community/group/${groupId}/desk?player=${p.player.id}`}
                  >
                    Manage purchases and benefits
                  </Link>
                </article>
                <article className="rounded-2xl border bg-card p-5">
                  <h3 className="font-semibold">Court bookings</h3>
                  {p.bookings.length ? (
                    p.bookings.map((b) => (
                      <p key={b.id} className="mt-3 text-sm">
                        {b.court || b.title} ·{" "}
                        {venueDate(b.start_time, timezone)}
                      </p>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No court bookings yet.
                    </p>
                  )}
                </article>
                <article className="rounded-2xl border bg-card p-5">
                  <h3 className="font-semibold">Purchases</h3>
                  {p.purchases.length ? (
                    p.purchases.map((b) => (
                      <div
                        key={b.id}
                        className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"
                      >
                        <div>
                          <p>{b.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {venueDate(b.created_at, timezone)} ·{" "}
                            {b.status.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div>
                          {formatMoney(b.amount_cents - b.refunded_cents)}
                          {b.refunded_cents > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {formatMoney(b.refunded_cents)} refunded
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No purchases yet.
                    </p>
                  )}
                </article>
              </>
            ) : null}
          </section>
        </div>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && !working && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === true ? "Add venue guest" : "Edit player contact"}
            </DialogTitle>
            <DialogDescription>
              Contact details are visible only to your venue staff.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-4"
              key={editing === true ? "new" : editing.id}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void act(async () => {
                  const c = await rpc<VenueCustomer>("venue_customer_save", {
                    p_venue: venue,
                    p_id: editing === true ? null : editing.id,
                    p_expected: editing === true ? null : editing.updated_at,
                    p_first: data.get("first"),
                    p_last: data.get("last"),
                    p_email: data.get("email"),
                    p_phone: data.get("phone"),
                  });
                  setEditing(null);
                  setParams({ player: c.id });
                  setNotice("Player record saved.");
                });
              }}
            >
              <label className="block text-sm">
                First name
                <Input
                  name="first"
                  required
                  maxLength={80}
                  defaultValue={editing === true ? "" : editing.first_name}
                />
              </label>
              <label className="block text-sm">
                Last name
                <Input
                  name="last"
                  maxLength={80}
                  defaultValue={editing === true ? "" : editing.last_name}
                />
              </label>
              <label className="block text-sm">
                Email
                <Input
                  name="email"
                  type="email"
                  maxLength={254}
                  defaultValue={editing === true ? "" : editing.email || ""}
                />
              </label>
              <label className="block text-sm">
                Phone
                <Input
                  name="phone"
                  type="tel"
                  maxLength={40}
                  defaultValue={editing === true ? "" : editing.phone || ""}
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={working}>
                {working ? "Saving…" : "Save player"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <DocumentPublisher
        value={publishing}
        working={working}
        error={error}
        onClose={() => !working && setPublishing(null)}
        onSave={(title, body, required) =>
          void act(async () => {
            await rpc("venue_document_publish", {
              p_venue: venue,
              p_title: title,
              p_body: body,
              p_required: required,
              p_replace:
                publishing && publishing !== true ? publishing.id : null,
            });
            setPublishing(null);
            setNotice(
              "Document published. Players will acknowledge this version before check-in.",
            );
          })
        }
      />
    </main>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
function DocumentPublisher({
  value,
  working,
  error,
  onClose,
  onSave,
}: {
  value: VenueDocument | true | null;
  working: boolean;
  error: string;
  onClose: () => void;
  onSave: (title: string, body: string, required: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    setBody(value && value !== true ? value.body : "");
    setFileError("");
  }, [value]);
  return (
    <Dialog
      open={!!value}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setBody("");
          setFileError("");
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {value === true
              ? "Publish venue document"
              : "Publish a new version"}
          </DialogTitle>
          <DialogDescription>
            Use your venue’s approved wording. Publication is immediate;
            replacing a document preserves previous acknowledgments and requires
            players to accept the new version.
          </DialogDescription>
        </DialogHeader>
        {value && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              onSave(
                String(d.get("title")),
                String(d.get("body")),
                d.get("required") === "on",
              );
            }}
          >
            <label className="block text-sm">
              Document title
              <Input
                name="title"
                required
                maxLength={150}
                defaultValue={value === true ? "" : value.title}
              />
            </label>
            <label className="block text-sm">
              Upload wording (.txt or .md)
              <Input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={async (e) => {
                  setFileError("");
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 100000) {
                    setFileError("Choose a text file smaller than 100 KB.");
                    return;
                  }
                  try {
                    setBody(await f.text());
                  } catch {
                    setFileError(
                      "Could not read this file. Paste the wording below.",
                    );
                  }
                }}
              />
            </label>
            <label className="block text-sm">
              Full document wording
              <Textarea
                key={value === true ? "new" : value.id}
                name="body"
                required
                minLength={20}
                maxLength={100000}
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="required"
                type="checkbox"
                defaultChecked={value === true ? true : value.required}
              />
              Require acceptance before participation
            </label>
            {(error || fileError) && (
              <p role="alert" className="text-sm text-destructive">
                {fileError || error}
              </p>
            )}
            <Button type="submit" disabled={working || !!fileError}>
              {working ? "Publishing…" : "Publish document"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
