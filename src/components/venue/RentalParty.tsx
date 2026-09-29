import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
export interface RentalPartyData {
  id: string;
  venue_id: string;
  timezone?: string;
  group_id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  can_manage: boolean;
  members: { id: string; name: string; lead: boolean; is_you: boolean }[];
}
export function RentalParty({
  booking,
  timeZone = "America/New_York",
}: {
  booking: string;
  timeZone?: string;
}) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["rental-party", booking, user?.id],
    queryFn: () =>
      rpc<RentalPartyData>("venue_rental_party", { p_booking: booking }),
  });
  const players = useQuery({
    queryKey: ["rental-player-search", booking, user?.id, search],
    enabled: !!q.data?.can_manage && search.trim().length >= 2,
    queryFn: () =>
      rpc<{ id: string; name: string }[]>("venue_rental_player_search", {
        p_booking: booking,
        p_search: search,
      }),
  });
  async function change(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setSearch("");
      await q.refetch();
      await client.invalidateQueries({ queryKey: ["venue-attendance"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the party.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Private booking · players</h3>
      {q.isPending ? (
        <p role="status">Loading your party...</p>
      ) : (
        q.data && (
          <>
            <p className="text-sm">
              {q.data.title} ·{" "}
              {venueDate(q.data.start_time, q.data.timezone || timeZone)}
            </p>
            <p className="text-xs text-muted-foreground">
              Booking details are visible to the renter, assigned players and
              venue staff. Each player signs their own venue waiver before
              arrival.
            </p>
            <ul className="divide-y">
              {q.data.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {m.name}
                    {m.lead ? " · Renter" : ""}
                    {m.is_you ? " · You" : ""}
                  </span>
                  {q.data.can_manage && !m.lead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void change(() =>
                          rpc("venue_rental_party_remove", {
                            p_booking: booking,
                            p_visit: m.id,
                          }),
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {q.data.can_manage && Date.parse(q.data.end_time) > Date.now() && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Add PULSE players
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by player name"
                  />
                </label>
                {players.isFetching && (
                  <p role="status" className="text-sm">
                    Searching...
                  </p>
                )}
                {players.data?.map((p) => (
                  <div
                    className="flex items-center justify-between gap-3"
                    key={p.id}
                  >
                    <span className="text-sm">{p.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void change(() =>
                          rpc("venue_rental_party_add", {
                            p_booking: booking,
                            p_user: p.id,
                          }),
                        )
                      }
                    >
                      Add player
                    </Button>
                  </div>
                ))}
                {search.trim().length >= 2 && players.data?.length === 0 && (
                  <p className="text-sm">No matching players.</p>
                )}
              </div>
            )}
            <Link
              className="inline-block text-sm font-medium underline"
              to={`/player/community/group/${q.data.group_id}/my-visit?venue=${q.data.venue_id}`}
            >
              Review your waiver before arrival
            </Link>
          </>
        )
      )}
      {(error || q.error || players.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || q.error?.message || players.error?.message}
        </p>
      )}
    </section>
  );
}
export function MyRentalParties({
  venue,
  timeZone,
}: {
  venue: string;
  timeZone: string;
}) {
  const { user } = useAuthState();
  const q = useQuery({
    queryKey: ["my-rental-parties", venue, user?.id],
    queryFn: () =>
      rpc<RentalPartyData[]>("venue_my_rental_parties", { p_venue: venue }),
  });
  return (
    <section className="mx-auto mt-6 max-w-2xl space-y-3 px-4">
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data?.map((p) => (
        <RentalParty key={p.id} booking={p.id} timeZone={timeZone} />
      ))}
    </section>
  );
}
