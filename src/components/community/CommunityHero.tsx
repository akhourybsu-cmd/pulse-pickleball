import { useState } from "react";
import { BadgeCheck, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunityBrandMark } from "./CommunityBrandMark";
import { VenueCoverImage } from "@/components/venue/VenueCoverImage";
import { InviteModal } from "./InviteModal";
import { venueChrome } from "@/lib/venues/branding";
import { communityUrl } from "@/lib/communityShare";
import type { PublicCommunity } from "@/hooks/usePublicCommunity";

export function CommunityHero({
  group,
  inviteCode,
}: {
  group: Pick<
    PublicCommunity,
    | "id"
    | "name"
    | "venue"
    | "cover_url"
    | "icon_url"
    | "member_count"
    | "is_venue_verified"
  >;
  inviteCode?: string;
}) {
  const [sharing, setSharing] = useState(false);
  const venue = group.venue;
  const name = venue?.name || group.name;
  const chrome = venueChrome(venue);
  return (
    <>
      <section
        className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:rounded-3xl"
        aria-label={name}
      >
        <div
          className="relative h-28 overflow-hidden bg-[#18242a] sm:h-44"
          style={{ backgroundImage: chrome?.backgroundImage }}
        >
          <VenueCoverImage
            src={venue?.cover_image_url || group.cover_url}
            fit={venue?.cover_image_fit}
            crop={venue?.cover_crop} focalPoint={venue?.cover_focal_point}
            alt={`${name} cover`}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-primary/50"
          />
        </div>
        <div className="relative p-5 pt-0 sm:p-7 sm:pt-0">
          <div className="flex items-end justify-between gap-3">
            <CommunityBrandMark
              group={group}
              className="-mt-7 h-20 w-20 bg-secondary text-[80px] ring-4 ring-card sm:h-24 sm:w-24 sm:text-[96px]"
            />
            <Button
              variant="outline"
              className="mt-3 min-h-11 shrink-0 gap-2 rounded-full"
              aria-label={`Share ${name}`}
              onClick={() => setSharing(true)}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {group.is_venue_verified && venue && (
              <BadgeCheck className="h-4 w-4" />
            )}
            {inviteCode
              ? "You’re invited"
              : group.is_venue_verified && venue
              ? "Verified venue community"
              : "Pickleball community"}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
            {name}
          </h1>
          {venue?.tagline && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
              {venue.tagline}
            </p>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {group.member_count ?? 0}{" "}
            {group.member_count === 1 ? "member" : "members"}
          </p>
        </div>
      </section>
      <InviteModal
        open={sharing}
        onOpenChange={setSharing}
        inviteCode={inviteCode || null}
        shareUrl={communityUrl(group.id)}
        groupName={name}
      />
    </>
  );
}
