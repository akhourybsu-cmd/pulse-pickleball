import { VenueTheme } from "@/components/venue/VenueTheme";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  venueRpc as rpc,
  type VisitDocumentView,
} from "@/lib/venues/customerRecords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A short-lived, individual visit link. It never exposes a directory or staff session. */
export default function VenueVisit() {
  const { token = "" } = useParams();
  return <VenueVisitContent token={token} />;
}
export function VenueVisitContent({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const q = useQuery({
    queryKey: ["venue-visit-documents", token],
    queryFn: () =>
      rpc<VisitDocumentView>("venue_visit_document_view", { p_token: token }),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });
  const data = q.data;
  return (
    <VenueTheme brand={data?.brand}>
      <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
        <div className="mx-auto max-w-2xl space-y-6">
          <header>
            <p className="text-sm font-medium text-muted-foreground">
              Welcome to
            </p>
            <h1 className="text-3xl font-bold">
              {data?.venue_name || "Your venue"}
            </h1>
            {data && (
              <p className="mt-3 text-lg">Your visit, {data.player_name}</p>
            )}
          </header>
          {q.isPending && <p role="status">Opening your visit…</p>}
          {(error || q.error) && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 p-4"
            >
              {error || q.error?.message}
            </p>
          )}
          {data && !q.isError && (
            <>
              <p className="text-sm text-muted-foreground">
                Review the venue’s documents below. Your acknowledgment is saved
                with the exact version shown.
              </p>
              {data.documents.map((d) => (
                <article
                  key={d.id}
                  className="rounded-2xl border bg-card p-5 sm:p-6"
                >
                  <h2 className="text-xl font-semibold">{d.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Version {d.version} · {d.required ? "Required" : "Optional"}
                  </p>
                  <div
                    className="my-5 max-h-[45dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border bg-background p-4 text-sm leading-relaxed"
                    tabIndex={0}
                    aria-label={`${d.title} wording`}
                  >
                    {d.body}
                  </div>
                  {d.accepted_at ? (
                    <p className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-5 w-5" />
                      Acknowledgment saved
                    </p>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (working) return;
                        const f = new FormData(e.currentTarget);
                        setWorking(true);
                        setError("");
                        try {
                          await rpc("venue_document_accept", {
                            p_token: token,
                            p_document: d.id,
                            p_signer: f.get("signer"),
                            p_agree: f.get("agree") === "on",
                          });
                          await q.refetch();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Could not save acknowledgment."
                          );
                        } finally {
                          setWorking(false);
                        }
                      }}
                    >
                      <label className="block text-sm font-medium">
                        Your full name
                        <Input
                          name="signer"
                          required
                          minLength={2}
                          maxLength={160}
                          autoComplete="name"
                          className="mt-1"
                        />
                      </label>
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          name="agree"
                          type="checkbox"
                          required
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          I have read and acknowledge the document shown above.
                          I am signing for myself or as the participant’s
                          authorized parent or guardian.
                        </span>
                      </label>
                      <Button type="submit" disabled={working}>
                        {working ? "Saving…" : "Save acknowledgment"}
                      </Button>
                    </form>
                  )}
                </article>
              ))}
              {data.visits?.map((v) => (
                <article key={v.id} className="rounded-2xl border bg-card p-5">
                  <h2 className="text-lg font-semibold">{v.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: data.timezone || "America/New_York",
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(v.start_time))}
                  </p>
                  {v.checked_in_at ? (
                    <p className="mt-3 font-semibold">
                      You are checked in. Enjoy your visit.
                    </p>
                  ) : v.visit_status === "pending_payment" ? (
                    <p className="mt-3 text-sm">
                      Payment is awaiting confirmation. See the front desk if
                      you need help.
                    </p>
                  ) : (
                    <Button
                      className="mt-4 h-12"
                      disabled={
                        working ||
                        data.documents.some(
                          (d) => d.required && !d.accepted_at
                        ) ||
                        Date.parse(v.start_time) >
                          Date.parse(
                            data.server_now || new Date().toISOString()
                          ) +
                            3600000
                      }
                      onClick={async () => {
                        setWorking(true);
                        setError("");
                        try {
                          await rpc("venue_self_checkin", {
                            p_token: token,
                            p_rsvp: v.kind === "registration" ? v.id : null,
                            p_visit: v.kind === "desk" ? v.id : null,
                          });
                          await q.refetch();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Could not check in. Please see the front desk."
                          );
                        } finally {
                          setWorking(false);
                        }
                      }}
                    >
                      {Date.parse(v.start_time) >
                      Date.parse(data.server_now || new Date().toISOString()) +
                        3600000
                        ? "Check-in opens one hour before start"
                        : working
                        ? "Checking in..."
                        : "Check me in"}
                    </Button>
                  )}
                </article>
              ))}
              {data.documents.every((d) => !d.required || d.accepted_at) && (
                <div className="rounded-2xl border bg-card p-5">
                  <h2 className="font-semibold">Documents complete</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your venue team can see your completed requirements.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </VenueTheme>
  );
}
