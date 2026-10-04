import { SectionHeader } from "@/components/layout/SectionHeader";
import { UpNextLeagueMatchesCard } from "./UpNextLeagueMatchesCard";
import { useMyUpcomingLeagueMatches } from "@/hooks/useMyUpcomingLeagueMatches";
import { useLeagueEntitlement } from "@/hooks/useLeagueEntitlement";

/**
 * Self-hiding section wrapper for the Dashboard's "Up next in leagues"
 * card. Renders the SectionHeader ONLY when there's data (mirrors
 * MyLeaguesSection so the whole surface flips together on entitlement
 * changes).
 */
export function UpNextLeagueMatchesSection() {
  const { entitled } = useLeagueEntitlement();
  const { rows, loading, error, retry } = useMyUpcomingLeagueMatches(3);

  if (!entitled) return null;
  if (loading) return null;
  if (error) return <div role="alert" className="rounded-xl border p-4 text-sm">Couldn’t load your upcoming league games. <button type="button" className="font-semibold underline" onClick={() => void retry()}>Try again</button></div>;
  if (rows.length === 0) return null;

  return (
    <div
      className="opacity-0 animate-fade-up"
      style={{ animationDelay: "175ms", animationFillMode: "forwards" }}
    >
      <SectionHeader label="Up next in leagues" />
      <UpNextLeagueMatchesCard />
    </div>
  );
}
