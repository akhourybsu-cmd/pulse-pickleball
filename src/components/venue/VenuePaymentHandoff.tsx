import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { Button } from "@/components/ui/button";
/** Legacy setup URLs and provider callbacks always re-enter the venue's own console. */
export function VenuePaymentHandoff({ venueId }: { venueId: string }) {
  const { user } = useAuthState();
  const [params] = useSearchParams();
  const q = useQuery({
    queryKey: ["venue-payment-route", venueId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id")
        .eq("venue_id", venueId)
        .eq("type", "venue_official")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "Venue payment settings could not be found. Open the venue and contact its staff for more information.",
        );
      return data.id;
    },
  });
  if (q.data)
    return (
      <Navigate
        replace
        to={
          "/player/community/group/" + q.data + "/payments?" + params.toString()
        }
      />
    );
  return (
    <section className="space-y-3 p-6">
      <p role={q.isError ? "alert" : "status"}>
        {q.isError
          ? "Could not open this venue’s payment settings. See the venue for more information."
          : "Opening venue payment settings…"}
      </p>
      {q.isError && (
        <Button variant="outline" onClick={() => q.refetch()}>
          Try again
        </Button>
      )}
    </section>
  );
}
