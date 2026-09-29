import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { localVenueDay } from "@/lib/venues/deskSales";
import { Input } from "@/components/ui/input";
export function MyCoachSchedule({
  venue,
  timeZone,
}: {
  venue: string;
  timeZone: string;
}) {
  const { user } = useAuthState();
  const [day, setDay] = useState(localVenueDay(timeZone));
  const q = useQuery({
    queryKey: ["my-coach-schedule", venue, user?.id, day],
    enabled: !!day,
    queryFn: () =>
      rpc<{
        coaches: { id: string; name: string }[];
        lessons: {
          id: string;
          title: string;
          start_time: string;
          end_time: string;
          status: string;
          courts: string[];
          player: string | null;
        }[];
      }>("venue_my_coach_schedule", { p_venue: venue, p_from: day, p_to: day }),
  });
  if (q.data?.coaches.length === 0) return null;
  return (
    <section className="mx-auto mt-6 max-w-2xl space-y-3 px-4">
      <h2 className="text-lg font-semibold">Your coaching schedule</h2>
      <label className="block text-sm">
        Teaching day ({timeZone})
        <Input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data?.lessons.map((l) => (
        <article key={l.id} className="rounded-xl border p-4">
          <h3 className="font-semibold">{l.title}</h3>
          <p className="text-sm">
            {venueDate(l.start_time, timeZone)} ...{" "}
            {venueDate(l.end_time, timeZone)}
          </p>
          <p className="text-sm">
            {l.courts.join(", ")}
            {l.player ? ` · ${l.player}` : ""} · {l.status}
          </p>
        </article>
      ))}
      {q.data?.lessons.length === 0 && (
        <p className="text-sm">No assigned lessons on this day.</p>
      )}
    </section>
  );
}
