import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { CommunityBrandMark } from "./CommunityBrandMark";
import { cn } from "@/lib/utils";
import "@/styles/community-clubhouse.css";

interface IdentityGroup {
  name: string;
  icon_url: string | null;
  cover_url: string | null;
  member_count?: number | null;
}

/** Shared identity for the public landing page and members' clubhouse. */
export function CommunityIdentity({
  group,
  label = "Pickleball community",
  compact = false,
  children,
}: {
  group: IdentityGroup;
  label?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn("club-identity", compact && "club-identity--compact")}
      aria-label={group.name}
    >
      <div className="club-identity-art" aria-hidden>
        {group.cover_url && (
          <img src={group.cover_url} alt="" className="club-identity-photo" />
        )}
        <svg viewBox="0 0 480 240" fill="none" className="club-court-lines">
          <rect x="40" y="-30" width="360" height="300" rx="150" />
          <rect x="100" y="15" width="240" height="210" rx="105" />
          <path d="M0 120h480M220-30v300M100 65h240M100 175h240" />
          <circle cx="395" cy="60" r="22" className="club-ball" />
        </svg>
      </div>
      <div className="club-identity-content">
        <CommunityBrandMark
          group={group}
          className="club-identity-mark h-16 w-16 text-[64px]"
        />
        <div className="min-w-0 flex-1">
          <p className="club-eyebrow">
            The clubhouse <span aria-hidden> / </span> {label}
          </p>
          <h1>{group.name}</h1>
          <p className="club-identity-members">
            <Users className="h-3.5 w-3.5" aria-hidden />
            <span>
              {group.member_count ?? 0}{" "}
              {group.member_count === 1 ? "member" : "members"}
            </span>
            <span className="club-identity-tagline">
              · A place to play together.
            </span>
          </p>
        </div>
        {children && <div className="club-identity-actions">{children}</div>}
      </div>
    </section>
  );
}
