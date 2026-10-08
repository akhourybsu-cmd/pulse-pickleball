import { useEffect, useState } from "react";
import { roundRobinEditError } from "@/lib/roundRobin/editGuidance";

/** Pin the version the host reviewed, even while the page receives live updates. */
export function useRoundRobinEditReview(open: boolean, editing: boolean, version: number, onRefresh?: () => Promise<number>) {
  const [reviewedVersion, setReviewedVersion] = useState(version);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !editing) { setReviewedVersion(version); setReviewError(null); }
  }, [open, editing, version]);
  const reviewLatest = async () => {
    if (reviewing) return false;
    setReviewing(true);
    try {
      const latest = onRefresh ? await onRefresh() : version;
      setReviewedVersion(latest);
      setReviewError(null);
      return true;
    } catch (error) {
      setReviewError(roundRobinEditError(error));
      return false;
    } finally { setReviewing(false); }
  };
  return { reviewedVersion, needsReview: editing && reviewedVersion !== version, reviewing, reviewError, reviewLatest };
}
