import { Link } from "react-router-dom";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { MyLeaguesCard } from "./MyLeaguesCard";
import { useMyLeagues } from "@/hooks/useMyLeagues";

/**
 * Full "My leagues" dashboard section. Wraps MyLeaguesCard so we can
 * hide the SectionHeader too when the user has no memberships — no
 * dead heading over an empty card.
 */
export function MyLeaguesSection() {
  const { rows, loading } = useMyLeagues();

  // Don't render at all until we know. Prevents flash-of-header.
  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div
      className="opacity-0 animate-fade-up"
      style={{ animationDelay: "170ms", animationFillMode: "forwards" }}
    >
      <SectionHeader
        label="My leagues"
        action={
          <Link
            to="/player/leagues"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            View all →
          </Link>
        }
      />
      <MyLeaguesCard />
    </div>
  );
}
