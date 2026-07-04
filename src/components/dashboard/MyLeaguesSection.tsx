import { Link } from "react-router-dom";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { MyLeaguesCard } from "./MyLeaguesCard";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { useLeagueEntitlement } from "@/hooks/useLeagueEntitlement";

/**
 * Full "My leagues" dashboard section. Wraps MyLeaguesCard so we can
 * hide the SectionHeader too when the user has no memberships — no
 * dead heading over an empty card.
 *
 * Gated on the League entitlement so the entire surface disappears
 * together when we ship the paid tier — the hook is stubbed to true
 * today.
 */
export function MyLeaguesSection() {
  const { entitled } = useLeagueEntitlement();
  const { rows, loading } = useMyLeagues();

  // Not entitled → hide the whole section, even if legacy memberships
  // exist. The /player/leagues route handles its own paywall messaging.
  if (!entitled) return null;
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
