import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { useGroupDetail } from "@/hooks/useGroupDetail";
const Payments = lazy(() => import("@/pages/player/Payments"));

export default function VenueAdminPayments() {
  const { groupId } = useParams();
  const { group } = useGroupDetail(groupId);
  return group?.venue_id ? (
    <Suspense fallback={<p role="status">Loading venue finances…</p>}>
      <Payments venueId={group.venue_id} />
    </Suspense>
  ) : null;
}
