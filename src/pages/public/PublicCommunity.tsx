import { useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowUpRight, MessageCircle, Users } from "lucide-react";
import { useAuthState } from "@/hooks/useAuthState";
import {
  usePublicCommunity,
  usePublicCommunityPrograms,
} from "@/hooks/usePublicCommunity";
import type { Group, GroupMember } from "@/hooks/useGroups";
import { GuestAccountPrompt } from "@/components/community/GuestAccountPrompt";
import { CommunityHero } from "@/components/community/CommunityHero";
import { CommunityJoinAction } from "@/components/community/CommunityJoinAction";
import { CommunityAccessPreview } from "@/components/community/CommunityAccessPreview";
import { VenueTheme } from "@/components/venue/VenueTheme";
import { VenueHome } from "@/components/venue/VenueHome";
import { VenueClubAbout } from "@/components/venue/VenueClubHome";
import { VenueEventCard } from "@/components/venue/VenueEventCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseVenueHours } from "@/lib/venues/hours";
import { eventSchedule } from "@/lib/venues/eventPresentation";
import { formatMoney } from "@/lib/payments";

export default function PublicCommunity({
  memberContext,
  publicGroupId,
}: {
  publicGroupId?: string;
  memberContext?: { group: Group; membership: GroupMember | null };
}) {
  const { groupId, slug } = useParams<{ groupId: string; slug: string }>();
  const { isAuthenticated } = useAuthState();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = usePublicCommunity(publicGroupId || groupId, slug);
  const requestedTab = params.get("tab") || "home";
  const tab = ["events", "play", "schedule"].includes(requestedTab)
    ? "events"
    : ["feed", "members", "files"].includes(requestedTab)
      ? "feed"
      : ["book", "chat", "more"].includes(requestedTab)
        ? requestedTab
        : "home";
  const page =
    tab === "events"
      ? Math.max(0, Math.min(416, Math.floor(Number(params.get("page"))) || 0))
      : 0;
  const programs = usePublicCommunityPrograms(query.data?.id, page);
  const [intent, setIntent] = useState<{
    action: string;
    returnTo: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    params.get("program")
  );
  if (query.isLoading)
    return (
      <p role="status" className="py-16 text-center">
        Opening the community…
      </p>
    );
  if (query.isError)
    return (
      <section role="alert" className="space-y-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Let’s try that again</h1>
        <p>We couldn’t load this page. Your link is still here.</p>
        <Button onClick={() => void query.refetch()}>Try again</Button>
      </section>
    );
  const group = query.data;
  if (!group)
    return (
      <section className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">
          This community isn’t available to browse
        </h1>
        <p className="text-muted-foreground">
          It may be private or not published yet. Use the invitation your host
          shared to access a private community.
        </p>
        {!isAuthenticated && (
          <GuestAccountPrompt action="access your communities" />
        )}
      </section>
    );
  if (isAuthenticated && slug)
    return (
      <Navigate
        to={`/player/community/group/${group.id}${location.search}${location.hash}`}
        replace
      />
    );
  const venue = group.venue;
  const name = venue?.name || group.name;
  const items = programs.data?.items ?? [];
  const selected = items.find((event) => event.id === selectedId);
  const selectedSchedule =
    selected &&
    eventSchedule(selected.start_time, selected.end_time, venue?.timezone);
  const destination = (destinationTab: string, eventId?: string) => {
    const next = new URLSearchParams(params);
    next.delete("view");
    if (!eventId) next.delete("page");
    next.delete("program");
    if (destinationTab === "home") next.delete("tab");
    else next.set("tab", destinationTab);
    if (eventId) next.set("program", eventId);
    return `${location.pathname}${next.size ? `?${next}` : ""}${location.hash}`;
  };
  const openTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.delete("view");
    next.delete("page");
    next.delete("program");
    if (value === "home") next.delete("tab");
    else next.set("tab", value);
    setParams(next);
  };
  const gate = (action: string, destinationTab = tab, eventId?: string) => {
    const returnTo = destination(destinationTab, eventId);
    setSelectedId(null);
    if (memberContext) navigate(returnTo, { replace: true });
    setIntent({ action, returnTo });
  };
  const access = (action: string, returnTo?: string) =>
    memberContext ? (
      <CommunityJoinAction
        group={memberContext.group}
        membership={memberContext.membership}
      />
    ) : (
      <GuestAccountPrompt name={name} action={action} returnTo={returnTo} />
    );
  const joinLabel =
    group.join_method === "request_to_join"
      ? "Request to join"
      : group.join_method === "invite_only"
        ? "Join with an invitation"
        : "Join the community";
  const schedule = (
    <section className="space-y-4" aria-label="Public event schedule">
      <div>
        <h2 className="text-2xl font-semibold">Coming up at {name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Browse sessions and prices. Sign in and join the community to
          register.
        </p>
      </div>
      {programs.isLoading ? (
        <p role="status">Loading the schedule…</p>
      ) : programs.isError ? (
        <div role="alert" className="space-y-3">
          <p>We couldn’t load the schedule.</p>
          <Button variant="outline" onClick={() => void programs.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((event) => (
            <VenueEventCard
              key={event.id}
              event={event}
              timeZone={venue?.timezone}
              onPick={setSelectedId}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">
          No upcoming events are listed{page ? " on this page" : ""}. Check back
          for the next session.
        </p>
      )}
      {(page > 0 || programs.data?.hasMore) && (
        <nav
          aria-label="Schedule pages"
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            disabled={!page || programs.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(page - 1));
              setParams(next);
            }}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button
            variant="outline"
            disabled={!programs.data?.hasMore || programs.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("page", String(page + 1));
              setParams(next);
            }}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  );

  return (
    <VenueTheme
      brand={venue}
      className="mx-auto min-w-0 max-w-6xl space-y-5 [overflow-wrap:anywhere]"
    >
      <CommunityHero group={group} />
      <nav
        aria-label="Community sections"
        className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b bg-background/95 py-3 backdrop-blur"
      >
        {[
          ["home", "Overview"],
          ...(venue ? [["book", "Courts"]] : []),
          ["events", "Events"],
          ["feed", "Community"],
          ["chat", "Chat"],
          ...(venue ? [["more", "Venue info"]] : []),
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={tab === value ? "default" : "ghost"}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => openTab(value)}
            className="min-h-11 shrink-0"
          >
            {label}
          </Button>
        ))}
      </nav>
      {tab === "home" ? (
        <div className="space-y-6">
          {venue ? (
            <VenueHome
              timeZone={venue.timezone}
              welcomeHeadline={venue.welcome_headline || `Welcome to ${name}`}
              welcomeMessage={venue.welcome_message || group.description}
              city={venue.city || null}
              state={venue.state || null}
              phone={venue.phone || null}
              email={venue.email}
              websiteUrl={venue.website_url || null}
              hours={parseVenueHours(venue.hours_of_operation)}
              nextUp={items.slice(0, 3)}
              hasCourts={venue.booking_enabled && group.courts.length > 0}
              freeNow={null}
              courtCount={group.courts.length}
              onBook={() => openTab("book")}
              onOpenPlay={() => openTab("events")}
              onPickProgram={setSelectedId}
              loadingPrograms={programs.isLoading}
              programsUnavailable={programs.isError}
              onRetryPrograms={() => void programs.refetch()}
            />
          ) : (
            <>
              <section className="rounded-2xl border bg-card p-6">
                <h2 className="text-2xl font-semibold">Welcome to {name}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {group.description ||
                    "Connect with local players and make more time for pickleball."}
                </p>
              </section>
              {schedule}
            </>
          )}
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Be part of {name}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Join to register for events and connect with the community.
              </p>
            </div>
            <Button
              className="min-h-11 shrink-0"
              onClick={() => gate("join this community", "home")}
            >
              {joinLabel}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Community updates", value: "feed", icon: Users },
              { label: "Community chat", value: "chat", icon: MessageCircle },
            ].map((item) => (
              <button
                key={item.value}
                className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-5 text-left font-semibold"
                onClick={() => openTab(item.value)}
              >
                <item.icon className="h-5 w-5 text-primary" />
                {item.label}
                <ArrowUpRight className="ml-auto h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      ) : tab === "events" ? (
        schedule
      ) : tab === "book" && venue ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Courts at {name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Find your space to play. Join the community to reserve a court.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.courts.map((court) => (
              <article
                key={court.id}
                className="rounded-2xl border bg-card p-5"
              >
                <h3 className="font-semibold">
                  {court.name || `Court ${court.court_number}`}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[court.court_type, court.surface_type]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </article>
            ))}
          </div>
          {!group.courts.length && (
            <p className="text-sm text-muted-foreground">
              Court details are coming soon.
            </p>
          )}
          {venue.booking_enabled && (
            <Button
              className="min-h-11"
              onClick={() =>
                gate("check availability and book a court", "book")
              }
            >
              Check availability
            </Button>
          )}
        </section>
      ) : tab === "more" && venue ? (
        <VenueClubAbout
          name={name}
          description={venue.welcome_message || group.description}
          city={venue.city}
          state={venue.state}
          hoursRaw={venue.hours_of_operation}
          timeZone={venue.timezone}
          phone={venue.phone}
          email={venue.email}
          websiteUrl={venue.website_url}
        />
      ) : (
        <CommunityAccessPreview
          title={tab === "chat" ? `Chat with ${name}` : `Inside ${name}`}
          description={
            tab === "chat"
              ? memberContext
                ? "Join the community to read messages and take part in the conversation."
                : "Community chat is for members. Create a PULSE account and join the community to read messages and take part."
              : memberContext
                ? "Posts, player details and shared files are for members. Join the community to see what’s happening."
                : "Posts, player details and shared files are for community members. Sign in and join to see what’s happening."
          }
        >
          {access(
            tab === "chat"
              ? "join the community and access chat"
              : "join the community and see member updates"
          )}
        </CommunityAccessPreview>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected &&
                selectedSchedule &&
                `${selectedSchedule.label} · ${selectedSchedule.time}${selectedSchedule.zone ? ` ${selectedSchedule.zone}` : ""}`}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <p className="whitespace-pre-line text-sm leading-7">
                {selected.description}
              </p>
              <p className="font-semibold">
                {selected.price_cents
                  ? `${formatMoney(selected.price_cents)} per player`
                  : "Free"}
              </p>
              <p className="text-sm text-muted-foreground">
                Sign in and join the community to see current availability, the
                player roster and registration options.
              </p>
              <Button
                className="min-h-11"
                disabled={selected.registration_paused}
                onClick={() =>
                  gate(
                    "register for this event",
                    venue ? "events" : "schedule",
                    selected.id
                  )
                }
              >
                {selected.registration_paused
                  ? "Registration paused"
                  : "Sign up for this event"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!intent}
        onOpenChange={(open) => {
          if (!open) setIntent(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {memberContext
                ? `Join ${name}`
                : "Join in with a free PULSE account"}
            </DialogTitle>
            <DialogDescription>
              {memberContext
                ? "Join the community to take part. Community approval and venue requirements still apply."
                : `Create an account or sign in to ${intent?.action}. You’ll return here to join the community.`}
            </DialogDescription>
          </DialogHeader>
          {access(intent?.action || "join this community", intent?.returnTo)}
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => setIntent(null)}
          >
            Keep looking around
          </Button>
        </DialogContent>
      </Dialog>
    </VenueTheme>
  );
}
