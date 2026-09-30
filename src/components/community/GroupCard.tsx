import { memo } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Lock,
  Eye,
  BadgeCheck,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GroupWithMembership } from "@/hooks/useGroups";
import { fetchGroupPosts } from "@/hooks/useGroupPosts";
import { fetchGroupEvents } from "@/hooks/useGroupEvents";
import { CommunityBrandMark } from "./CommunityBrandMark";
import { VenueCoverImage } from "@/components/venue/VenueCoverImage";
import { normalizeHex } from "@/lib/venues/branding";
import { communityLocation } from "@/lib/community/discovery";
const typeLabels: Record<string, string> = {
  crew: "Player crew",
  league: "League",
  open_play: "Open play",
  venue_official: "Venue community",
  tournament: "Tournament",
  club: "Pickleball club",
};
interface Props {
  group: GroupWithMembership;
  showJoinButton?: boolean;
  onJoin?: (groupId: string) => Promise<void>;
  isJoining?: boolean;
}
export const GroupCard = memo(function GroupCard({
  group,
  showJoinButton,
  onJoin,
  isJoining,
}: Props) {
  const client = useQueryClient();
  const isMember = group.membership?.status === "active";
  const verified =
    group.type === "venue_official" && group.is_venue_verified === true;
  const accent = normalizeHex(group.venue?.primary_color) || "#166f63";
  const place = communityLocation(group);
  const location = [place.city, place.state].filter(Boolean).join(", ");
  const unread = group.unread_count ?? 0;
  const prefetch = () => {
    if (!isMember) return;
    void client.prefetchQuery({
      queryKey: ["group-posts", group.id],
      queryFn: () => fetchGroupPosts(group.id),
      staleTime: 30000,
    });
    void client.prefetchQuery({
      queryKey: ["group-events", group.id],
      queryFn: () => fetchGroupEvents(group.id),
      staleTime: 60000,
    });
  };
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md",
        verified && "shadow-[0_8px_24px_-18px_hsl(var(--foreground)/0.3)]",
      )}
    >
      <Link
        to={"/player/community/group/" + group.id}
        className="flex min-w-0 flex-1 flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        onMouseEnter={prefetch}
      >
        {verified && (
          <div
            className="relative h-20 overflow-hidden"
            style={{ background: accent }}
          >
            <VenueCoverImage
              src={group.venue?.cover_image_url || group.cover_url}
              crop={group.venue?.cover_crop}
              fit={group.venue?.cover_image_fit}
              focalPoint={group.venue?.cover_focal_point}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
            <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-700" />
              Verified venue
            </span>
          </div>
        )}
        <div className="flex min-w-0 items-start gap-3 p-4">
          <CommunityBrandMark
            group={group}
            className="h-12 w-12 text-[48px] ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold leading-snug text-foreground">
              {group.venue?.name || group.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {typeLabels[group.type] || "Community"}
              {isMember &&
                (group.membership?.role === "owner"
                  ? " · Owner"
                  : group.membership?.role === "moderator"
                    ? " · Moderator"
                    : " · Joined")}
            </p>
          </div>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </div>
        {(group.venue?.tagline || group.description) && (
          <p className="px-4 pb-3 text-sm leading-5 text-muted-foreground line-clamp-2">
            {group.venue?.tagline || group.description}
          </p>
        )}
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 text-xs text-muted-foreground">
          {location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="break-words">{location}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {group.member_count} members
          </span>
          {group.visibility === "private" && (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Private
            </span>
          )}
          {group.visibility === "unlisted" && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Unlisted
            </span>
          )}
          {unread > 0 && (
            <span
              aria-label={`${unread} unread updates`}
              className="ml-auto rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200"
            >
              {unread > 99 ? "99+" : unread} new
            </span>
          )}
        </div>
      </Link>
      {showJoinButton &&
        !isMember &&
        onJoin &&
        group.join_method !== "invite_only" && (
          <div className="border-t border-border/60 px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              className="min-h-10 w-full rounded-xl"
              disabled={isJoining}
              onClick={() => void onJoin(group.id)}
            >
              {isJoining
                ? "Joining…"
                : group.join_method === "request_to_join"
                  ? "Request to join"
                  : "Join community"}
            </Button>
          </div>
        )}
    </article>
  );
});
