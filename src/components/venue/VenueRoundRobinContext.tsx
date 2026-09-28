import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/hooks/useAuthState";
import { eventManagementRpc as rpc } from "@/lib/venues/eventManagement";
import type { VenueCompetitions } from "@/lib/venues/competitions";
import { eventSchedule } from "@/lib/venues/eventPresentation";
import { formatMoney } from "@/lib/payments";

export function VenueRoundRobinContext({
  groupId,
  roundRobinId,
  onPrepared,
}: {
  groupId: string;
  roundRobinId: string;
  onPrepared: () => void;
}) {
  const { user } = useAuthState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["venue-competitions", groupId, user?.id],
    queryFn: () =>
      rpc<VenueCompetitions>("get_venue_competitions", { p_group: groupId }),
    refetchInterval: busy ? false : 30000,
  });
  const e = query.data?.round_robins.find(
    (e) => e.round_robin_id === roundRobinId
  );
  if (query.isPending)
    return (
      <p role="status" className="rr-event-width p-4">
        Loading venue event…
      </p>
    );
  if (query.isError) return <div className="rr-event-width my-4 rounded-xl border p-4"><p role="alert" className="text-sm">Venue registration details could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>;
  if (!e) return null;
  const schedule = eventSchedule(
    e.start_time,
    e.end_time,
    query.data?.venue.timezone
  );
  return (
    <section
      className="rr-event-width my-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5"
      aria-label="Linked venue event"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {query.data?.venue.name} · Scheduled venue event
          </p>
          <h2 className="mt-1 font-semibold">
            {schedule?.label} · {schedule?.time} {schedule?.zone}
          </h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link
            to={`/player/community/group/${groupId}/events/manage?event=${e.id}`}
          >
            Event & registrations
          </Link>
        </Button>
      </div>
      <p className="mt-3 text-sm">
        {e.courts
          .map(
            (c, i) =>
              `Play court ${i + 1}: ${c.name || `Court ${c.court_number}`}`
          )
          .join(" · ")}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {e.confirmed}
        {e.capacity ? ` / ${e.capacity}` : ""} confirmed ·{" "}
        {e.price_cents
          ? `${formatMoney(e.price_cents)} / player`
          : "Free registration"}
        {e.skill_level_min != null || e.skill_level_max != null
          ? ` · Skill ${e.skill_level_min ?? "Any"}–${
              e.skill_level_max ?? "Any"
            }`
          : ""}
        {e.rotation_style ? ` · ${e.rotation_style.replace(/_/g, " ")}` : ""}
      </p>
      {!e.canceled_at && e.status === "draft" && !e.roster_locked_at ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6">
            Confirmed signups sync automatically. Close registration to lock the
            playing roster, then generate matchups below. Pending checkouts must
            finish first.
          </p>
          <Button
            disabled={busy || e.confirmed < 4}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await rpc("prepare_venue_round_robin", { p_event: e.id });
                await query.refetch();
                onPrepared();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not prepare play."
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing…" : "Close registration & prepare play"}
          </Button>
          {e.confirmed < 4 && (
            <p className="text-xs text-muted-foreground">
              At least four confirmed players are required.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm">
          {e.canceled_at
            ? "The venue event is canceled."
            : "Registration is closed. Manage matchups, scores and playing-roster changes below."}
        </p>
      )}
      {!!e.roster_locked_at &&
        !!(e.roster_additions || e.roster_withdrawals) &&
        !e.canceled_at && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm"
          >
            Registration changed after preparation: {e.roster_additions}{" "}
            addition(s), {e.roster_withdrawals} withdrawal(s). Review
            registrations and update the playing roster before continuing.
          </p>
        )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
