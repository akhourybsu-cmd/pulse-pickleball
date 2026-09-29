import { MyCoachSchedule } from "@/components/venue/MyCoachSchedule";
import { MyRentalParties } from "@/components/venue/RentalParty";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { VenueVisitContent } from "@/pages/VenueVisit";
import { Button } from "@/components/ui/button";
export default function VenueMyVisit() {
  const { groupId = "" } = useParams();
  const [params] = useSearchParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const venue = params.get("venue") || group?.venue_id;
  const q = useQuery({
    queryKey: ["my-venue-visit", venue, user?.id],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<{
        visit_token: string;
        timezone: string;
        entitlements: {
          id: string;
          name: string;
          kind: string;
          remaining_units: number;
          expires_at: string;
          member_discount_percent: number;
        }[];
      }>("venue_player_visit_context", { p_venue: venue }),
    refetchOnWindowFocus: true,
  });
  return (
    <>
      <nav className="mx-auto flex max-w-2xl justify-between gap-3 px-4 pt-5">
        <Link to={`/player/community/group/${groupId}`}>
          <Button variant="outline">Back to venue</Button>
        </Link>
        <Link to="/player/payments">
          <Button variant="outline">Payments & purchases</Button>
        </Link>
      </nav>
      {q.error ? (
        <p role="alert" className="mx-auto max-w-2xl p-5">
          {q.error.message}
        </p>
      ) : !q.data ? (
        <p role="status" className="mx-auto max-w-2xl p-5">
          Opening your visit…
        </p>
      ) : (
        <>
          {q.data.entitlements.length > 0 && (
            <section className="mx-auto mt-6 max-w-2xl space-y-3 px-4">
              <h2 className="text-lg font-semibold">
                Your memberships & passes
              </h2>
              {q.data.entitlements.map((e) => (
                <article key={e.id} className="rounded-xl border p-4">
                  <h3 className="font-medium">{e.name}</h3>
                  <p className="text-sm">
                    {e.kind === "membership"
                      ? `Active membership · ${e.member_discount_percent}% court discount`
                      : `${e.remaining_units} ${
                          e.kind === "court_hours" ? "court hours" : "uses"
                        } remaining`}{" "}
                    · Valid through {venueDate(e.expires_at, q.data.timezone)}
                  </p>
                </article>
              ))}
            </section>
          )}
          <VenueVisitContent token={q.data.visit_token} />
          <MyRentalParties venue={venue!} timeZone={q.data.timezone} />
          <MyCoachSchedule venue={venue!} timeZone={q.data.timezone} />
        </>
      )}
    </>
  );
}
