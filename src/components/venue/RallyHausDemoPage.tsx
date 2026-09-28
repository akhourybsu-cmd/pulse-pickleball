import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImageIcon,
  MapPin,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuestAccountPrompt } from "@/components/community/GuestAccountPrompt";
import { useAuthState } from "@/hooks/useAuthState";
import type { Group } from "@/hooks/useGroups";
import { VenueTheme } from "./VenueTheme";
import { VenueBrandMark } from "./VenueBrandMark";
import { VenueClubAbout } from "./VenueClubHome";
import { VenueFilter } from "./VenuePlayerPages";
import { clubDate, clubTime } from "@/lib/venues/clubPresentation";
import { publicWebsiteUrl } from "@/lib/communityAccess";
import {
  categoryLabels,
  DEMO_TIME_ZONE,
  demoDayKey,
  demoPhotos,
  demoPhotoUrl,
  nextDemoOccasions,
  occasionCategories,
  rallyHausSchedule,
  type DemoSession,
} from "@/lib/venues/rallyHausDemo";
import { venueCalendarNow } from "@/lib/venues/timezone";

type ShowcaseGroup = Pick<Group, "id" | "name" | "venue" | "icon_url">;
type DemoTab = "home" | "play" | "feed" | "events" | "more" | "book";
const tabs: [DemoTab, string][] = [
  ["home", "Overview"],
  ["play", "Play"],
  ["feed", "Community"],
  ["events", "Events"],
  ["more", "About"],
];
const samplePosts = [
  {
    type: "Venue update",
    title: "Your next good game starts here.",
    image: "paddles",
    text: "New to the Haus? Start with Your First Rally, meet the crew at open play, or make a night of it at the Paddles & Pizza Social.",
    event: "first-rally",
    action: "Explore the beginner clinic",
  },
  {
    type: "Looking to play",
    title: "One more doubles pair?",
    image: "match",
    text: "Sample player post: looking for two intermediate players for After-Work Open Play. Friendly points, new partners and one more game before heading home.",
    event: "after-work",
    action: "View the session",
  },
  {
    type: "Competition",
    title: "A little competition. A lot of community.",
    image: "action",
    text: "The Weekend Classic sample event shows how divisions, pool play and a medal bracket can come together for a full day of pickleball.",
    event: "tournament",
    action: "Explore the Weekend Classic",
  },
  {
    type: "Around the Haus",
    title: "Practice makes a better partner.",
    image: "play",
    text: "Our sample Drill Club brings players together for purposeful reps. Pick a focus, rotate partners and take something new into your next game.",
    event: "drill",
    action: "Explore Drill Club",
  },
];

/** A venue-scoped, clearly labeled showcase. Never writes to live programs, RSVPs or payments. */
export default function RallyHausDemoPage({ group }: { group: ShowcaseGroup }) {
  const { isAuthenticated } = useAuthState();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const calendarDay = demoDayKey(venueCalendarNow(DEMO_TIME_ZONE, clock));
  // Do not reshuffle the calendar while a detail dialog is open.
  const sessions = useMemo(() => rallyHausSchedule(clock), [calendarDay]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = [...new Set(sessions.map((s) => s.day))];
  const rawTab = params.get("tab");
  const tab: DemoTab =
    rawTab === "chat"
      ? "feed"
      : tabs.some(([key]) => key === rawTab) || rawTab === "book"
      ? (rawTab as DemoTab)
      : "home";
  const day = days.includes(params.get("day") || "")
    ? params.get("day")!
    : days[0];
  const category = [
    "open_play",
    "clinic",
    "lesson",
    "practice",
    "junior",
  ].includes(params.get("demoCategory") || "")
    ? params.get("demoCategory")!
    : "all";
  const eventFilter = occasionCategories.some(
    (value) => value === params.get("demoEventFilter")
  )
    ? params.get("demoEventFilter")!
    : "all";
  const selected = sessions.find((s) => s.key === params.get("demoProgram"));
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const [responses, setResponses] = useState<
    Record<string, "going" | "waitlist">
  >({});
  const [vote, setVote] = useState<string | null>(null);
  const requestedSlot = params.get("demoSlot");
  const booking =
    requestedSlot && /^(2|3|4):00 PM · Court [1-6]$/.test(requestedSlot)
      ? requestedSlot
      : null;
  const [booked, setBooked] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const venue = group.venue;
  const name = venue?.name || group.name;
  const website = publicWebsiteUrl(venue?.website_url);
  const upcoming = sessions.filter(
    (s) => Date.parse(s.start) > clock.getTime()
  );
  const occasions = nextDemoOccasions(sessions, clock);
  const changeParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, {
      replace: !!updates.demoProgram || updates.demoProgram === null,
    });
  };
  const setBooking = (value: string | null) =>
    changeParams({ demoSlot: value });
  const openTab = (value: DemoTab) => {
    changeParams({ tab: value, demoProgram: null });
    setNotice("");
  };
  const selectProgram = (s: DemoSession) => {
    changeParams({ demoProgram: s.key });
    setNotice("");
  };
  const findProgram = (id: string) => upcoming.find((s) => s.id === id);
  const interact = (action: string, callback: () => void) =>
    isAuthenticated ? callback() : setGate(action);
  const liveParams = new URLSearchParams(params);
  liveParams.set("demo", "off");
  liveParams.delete("demoProgram");
  const liveUrl = `${location.pathname}?${liveParams}`;
  const reset = () => {
    setResponses({});
    setVote(null);
    setBooked([]);
    setBooking(null);
    setNotice("Demo reset. You can try every sample again.");
  };
  const selectedPhoto = photoIndex === null ? null : demoPhotos[photoIndex];
  const photoCredit = (
    <p className="text-xs leading-5 text-muted-foreground">
      Illustrative pickleball photography from Unsplash; these photos do not
      depict Rally Haus. Photographer credits are in the gallery.
    </p>
  );
  const renderCard = (s: DemoSession, compact = false) => (
    <ProgramCard
      key={s.key}
      session={s}
      compact={compact}
      onClick={() => selectProgram(s)}
      response={responses[s.key]}
    />
  );
  const gallery = (
    <section className="space-y-4" aria-label="Photo gallery">
      <SectionTitle
        eyebrow="THE GAME WE LOVE"
        title="A little court inspiration"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {demoPhotos.slice(0, 4).map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setPhotoIndex(i)}
            aria-label={`Open photo: ${photo.title}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={demoPhotoUrl(photo.id)}
              alt={photo.alt}
              loading="lazy"
              width={720}
              height={540}
              className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 text-left text-xs font-medium text-white">
              {photo.title}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {photoCredit}
        <Button
          variant="outline"
          className="min-h-11 rounded-xl"
          onClick={() => setPhotoIndex(0)}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          All 10 photos
        </Button>
      </div>
    </section>
  );

  return (
    <VenueTheme
      brand={venue}
      className="rounded-2xl font-sans [&_h1]:font-sans [&_h2]:font-sans [&_h3]:font-sans"
    >
      <div className="mx-auto max-w-6xl pb-8" data-testid="rally-haus-demo">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs sm:px-5">
          <p className="leading-5">
            <span className="mr-2 rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
              DEMO VENUE
            </span>
            Sample events, prices & availability.
          </p>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={reset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset demo
            </button>
            <Link
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              to={liveUrl}
            >
              Live venue
            </Link>
          </div>
        </div>
        <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md">
          <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
            <Link
              to="/player/community"
              aria-label="Back to communities"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <VenueBrandMark
              name={name}
              logoUrl={venue?.logo_url || group.icon_url}
              logoShape={venue?.logo_shape}
              logoImageFit={venue?.logo_image_fit}
              logoBackgroundColor={venue?.logo_background_color || "#ffffff"}
              className="h-10 w-10 text-[40px]"
            />
            <span className="min-w-0 flex-1 truncate text-lg font-semibold">
              {name}
            </span>
            <Button
              variant="outline"
              className="hidden min-h-11 rounded-xl sm:inline-flex"
              onClick={() => openTab("book")}
            >
              Book a court
            </Button>
          </div>
          <nav
            aria-label="Venue sections"
            className="scrollbar-hide flex overflow-x-auto px-3 sm:px-5"
          >
            {tabs.map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => openTab(key)}
                aria-current={key === tab ? "page" : undefined}
                className={`min-h-12 shrink-0 border-b-2 px-2.5 text-xs font-medium sm:px-5 sm:text-sm ${
                  key === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        {notice && (
          <p
            role="status"
            className="mx-5 mt-4 rounded-xl bg-primary/10 p-3 text-sm"
          >
            {notice}
          </p>
        )}

        {tab === "home" && (
          <>
            <section
              className="relative isolate m-4 overflow-hidden rounded-2xl bg-secondary sm:m-5"
              aria-label="Welcome to Rally Haus"
            >
              <img
                src={demoPhotoUrl("aerial")}
                alt="Illustrative photograph of sunlight across a court and net"
                width={1440}
                height={850}
                loading="eager"
                className="absolute inset-0 -z-20 h-full w-full object-cover"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#081b35]/95 via-[#081b35]/80 to-[#081b35]/20" />
              <div className="max-w-2xl px-6 py-10 text-white sm:px-9 sm:py-14">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                  Attleboro, Massachusetts · PULSE showcase
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                  Good games.
                  <br />
                  Great people.
                  <br />
                  <span className="text-[#b4dcff]">Your Rally Haus.</span>
                </h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-white/85">
                  From your first dink to a tournament weekend. Find your game,
                  bring your people, and make a little time to play.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    className="min-h-12 rounded-xl bg-white px-5 text-[#102847] hover:bg-white/90"
                    onClick={() => {
                      changeParams({ tab: "play", demoCategory: "open_play" });
                    }}
                  >
                    Find open play
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    className="min-h-12 rounded-xl border border-white/40 bg-black/20 px-5 text-white hover:bg-black/40"
                    onClick={() => openTab("events")}
                  >
                    Explore events
                  </Button>
                </div>
              </div>
              <span className="absolute bottom-3 right-4 text-[10px] text-white/80">
                Illustrative photo · Frankie Lopez / Unsplash
              </span>
            </section>
            <div className="space-y-9 px-4 sm:px-5">
              <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card py-4 text-center">
                <Stat value="18" label="sample programs" />
                <Stat value="10" label="ways to play" />
                <Stat value="14" label="days to explore" />
              </div>
              <section className="space-y-4">
                <SectionTitle
                  eyebrow="MAKE TIME TO PLAY"
                  title="Coming up at the Haus"
                  action="Full schedule"
                  onAction={() => openTab("play")}
                />
                <div className="grid gap-3 md:grid-cols-3">
                  {upcoming
                    .filter((s) => !occasionCategories.includes(s.category))
                    .slice(0, 3)
                    .map((s) => renderCard(s, true))}
                </div>
              </section>
              <section className="space-y-4">
                <SectionTitle
                  eyebrow="MORE THAN A MATCH"
                  title="Something to look forward to"
                  action="All events"
                  onAction={() => openTab("events")}
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {["tournament", "social", "league"]
                    .map((id) => findProgram(id))
                    .filter((s): s is DemoSession => !!s)
                    .map((s) => renderCard(s))}
                </div>
              </section>
              <section className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-2">
                <img
                  src={demoPhotoUrl("courts")}
                  alt="Paddle and balls ready for a beginner lesson"
                  loading="lazy"
                  className="h-52 w-full object-cover md:h-full"
                  width={720}
                  height={400}
                />
                <div className="p-6 sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    NEW TO PICKLEBALL?
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    You belong on court.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    No partner, paddle or experience needed for this sample
                    intro clinic. Start with the basics and leave ready for your
                    first rally.
                  </p>
                  <Button
                    className="mt-5 min-h-11 rounded-xl"
                    onClick={() => {
                      const s = findProgram("first-rally");
                      if (s) selectProgram(s);
                    }}
                  >
                    Explore Your First Rally
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </section>
              {gallery}
              <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-primary/5 p-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    The game is only half the story.
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Venue updates, playing partners and a say in what happens
                    next.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-xl"
                  onClick={() => openTab("feed")}
                >
                  Meet the community
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </section>
            </div>
          </>
        )}

        {tab === "play" && (
          <div className="space-y-5 p-4 sm:p-5">
            <SectionTitle
              eyebrow="PICK YOUR NEXT GAME"
              title="Play at Rally Haus"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Open play, coaching and practice, all in one place. Sample times
              shown in Eastern Time.
            </p>
            <div
              className="scrollbar-hide flex gap-2 overflow-x-auto pb-2"
              aria-label="Play categories"
            >
              {[
                ["all", "All play"],
                ["open_play", "Open play"],
                ["clinic", "Clinics"],
                ["lesson", "Lessons"],
                ["practice", "Practice"],
                ["junior", "Juniors"],
              ].map(([key, label]) => (
                <VenueFilter
                  key={key}
                  active={category === key}
                  onClick={() => changeParams({ demoCategory: key })}
                >
                  {label}
                </VenueFilter>
              ))}
              <VenueFilter active={false} onClick={() => openTab("book")}>
                Court reservations
              </VenueFilter>
            </div>
            <div
              className="scrollbar-hide flex gap-2 overflow-x-auto pb-2"
              aria-label="Choose a sample day"
            >
              {days.map((date, i) => {
                const value = sessions.find((s) => s.day === date)!;
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={day === date}
                    onClick={() => changeParams({ day: date })}
                    className={`min-h-16 min-w-[68px] rounded-xl border px-3 py-2 text-center ${
                      date === day
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground"
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-wide">
                      {i === 0
                        ? "Today"
                        : i === 1
                        ? "Tomorrow"
                        : new Date(value.start).toLocaleDateString("en-US", {
                            weekday: "short",
                            timeZone: DEMO_TIME_ZONE,
                          })}
                    </span>
                    <span className="mt-1 block text-lg font-semibold">
                      {date.slice(-2)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sessions
                .filter(
                  (s) =>
                    s.day === day &&
                    !occasionCategories.includes(s.category) &&
                    (category === "all" || s.category === category)
                )
                .map((s) => renderCard(s, true))}
            </div>
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => openTab("events")}
            >
              Looking for leagues or tournaments? Explore events
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {tab === "events" && (
          <div className="space-y-5 p-4 sm:p-5">
            <SectionTitle
              eyebrow="SAVE THE DATE"
              title="Events worth showing up for"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              A full sample lineup of tournaments, leagues, round robins,
              socials and special events.
            </p>
            <div
              className="scrollbar-hide flex gap-2 overflow-x-auto pb-2"
              aria-label="Event categories"
            >
              {[
                ["all", "Upcoming"],
                ["tournament", "Tournaments"],
                ["league", "Leagues"],
                ["round_robin", "Round robins"],
                ["social", "Socials"],
                ["special", "Special events"],
              ].map(([key, label]) => (
                <VenueFilter
                  key={key}
                  active={eventFilter === key}
                  onClick={() => changeParams({ demoEventFilter: key })}
                >
                  {label}
                </VenueFilter>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {occasions
                .filter(
                  (s) => eventFilter === "all" || eventFilter === s.category
                )
                .map((s) => renderCard(s))}
            </div>
          </div>
        )}

        {tab === "feed" && (
          <div className="space-y-6 p-4 sm:p-5">
            <SectionTitle
              eyebrow="YOUR PEOPLE. YOUR GAME."
              title="Around the Haus"
            />
            <p className="text-sm text-muted-foreground">
              Example venue updates and player conversations. All posts and poll
              results below are sample content.
            </p>
            <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
              <section className="space-y-5" aria-label="Sample community feed">
                {samplePosts.map((post) => (
                  <article
                    key={post.title}
                    className="overflow-hidden rounded-2xl border bg-card"
                  >
                    <div className="flex items-center gap-3 p-4">
                      <VenueBrandMark
                        name={name}
                        logoUrl={venue?.logo_url || group.icon_url}
                        logoBackgroundColor="#ffffff"
                        className="h-9 w-9 text-[36px]"
                      />
                      <div>
                        <p className="text-sm font-semibold">Rally Haus demo</p>
                        <p className="text-xs text-muted-foreground">
                          {post.type} · Sample post
                        </p>
                      </div>
                    </div>
                    <img
                      src={demoPhotoUrl(post.image)}
                      alt={
                        demoPhotos.find((p) => p.id === post.image)?.alt || ""
                      }
                      loading="lazy"
                      width={720}
                      height={400}
                      className="aspect-[16/8] w-full object-cover"
                    />
                    <div className="space-y-3 p-5">
                      <h3 className="text-lg font-semibold">{post.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {post.text}
                      </p>
                      <Button
                        variant="outline"
                        className="min-h-11 h-auto rounded-xl whitespace-normal"
                        onClick={() => {
                          const s = findProgram(post.event);
                          if (s) selectProgram(s);
                        }}
                      >
                        {post.action}
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                      </Button>
                    </div>
                  </article>
                ))}
              </section>
              <aside className="space-y-5">
                <section className="rounded-2xl border bg-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Community poll · Demo
                  </p>
                  <h3 className="mt-3 text-lg font-semibold">
                    What should we play next?
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Try a sample vote. Results stay in this demo.
                  </p>
                  <div className="mt-4 space-y-2">
                    {[
                      "Glow pickleball night",
                      "Mixed doubles ladder",
                      "Sunday skills clinic",
                    ].map((option, i) => (
                      <button
                        key={option}
                        onClick={() =>
                          interact("try the community poll", () =>
                            setVote(option)
                          )
                        }
                        aria-pressed={vote === option}
                        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm ${
                          vote === option
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span>{option}</span>
                        {vote && (
                          <span className="shrink-0 text-xs font-semibold">
                            {[18, 12, 7][i] + (vote === option ? 1 : 0)} votes
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {vote && (
                    <p role="status" className="mt-3 text-xs text-primary">
                      Sample vote added. No live poll was changed.
                    </p>
                  )}
                </section>
                <section className="rounded-2xl bg-primary/5 p-5">
                  <Users className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 text-lg font-semibold">
                    Find your regular crew.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Explore the real Rally Haus community for membership, player
                    profiles and chat.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 min-h-11 rounded-xl"
                  >
                    <Link
                      to={`/player/community/group/${group.id}?demo=off&tab=feed`}
                    >
                      Open live community
                    </Link>
                  </Button>
                </section>
                {!isAuthenticated && (
                  <GuestAccountPrompt
                    name={name}
                    action="try sample RSVPs and community interactions"
                  />
                )}
              </aside>
            </div>
          </div>
        )}

        {tab === "book" && (
          <div className="space-y-5 p-4 sm:p-5">
            <SectionTitle
              eyebrow="YOUR COURT. YOUR TIME."
              title="Try a court reservation"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Six illustrative courts, one sample afternoon. Choose a slot to
              preview a reservation. Nothing here reserves a real court or takes
              payment.
            </p>
            <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                {["2:00 PM", "3:00 PM", "4:00 PM"].map((time, t) => (
                  <section
                    key={time}
                    className="rounded-2xl border bg-card p-4"
                  >
                    <h3 className="mb-3 text-sm font-semibold">
                      {time} · 60 minutes
                    </h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Array.from({ length: 6 }, (_, i) => {
                        const key = `${time} · Court ${i + 1}`;
                        const occupied = (i + t) % 5 === 0;
                        const reserved = booked.includes(key);
                        return (
                          <button
                            key={key}
                            disabled={occupied || reserved}
                            aria-pressed={booking === key}
                            onClick={() => setBooking(key)}
                            className={`min-h-20 rounded-xl border p-3 text-left ${
                              booking === key
                                ? "border-primary bg-primary/10"
                                : occupied || reserved
                                ? "bg-muted/50 text-muted-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            <span className="block text-sm font-semibold">
                              Court {i + 1}
                            </span>
                            <span className="mt-1 block text-xs">
                              {reserved
                                ? "Demo reserved"
                                : occupied
                                ? "Sample program"
                                : "$24 · Available"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <aside className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold">Your sample reservation</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {booking || "Choose an available court to see the details."}
                </p>
                {booking && (
                  <>
                    <p className="my-5 border-y py-4 text-sm">
                      60 minutes{" "}
                      <strong className="float-right">$24 sample price</strong>
                    </p>
                    <Button
                      disabled={booked.includes(booking)}
                      className="min-h-12 w-full rounded-xl"
                      onClick={() =>
                        interact("try a sample court reservation", () => {
                          setBooked([...booked, booking]);
                          setNotice(
                            "Demo reservation complete. No real court was reserved and no payment was taken."
                          );
                        })
                      }
                    >
                      {booked.includes(booking)
                        ? "Demo reservation complete"
                        : "Simulate reservation"}
                    </Button>
                  </>
                )}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Example availability and pricing only. Reset the demo to start
                  again.
                </p>
              </aside>
            </div>
          </div>
        )}

        {tab === "more" && (
          <div className="space-y-8 p-4 sm:p-5">
            <div className="grid gap-8 md:grid-cols-2">
              <VenueClubAbout
                name={name}
                city={venue?.city}
                state={venue?.state}
                hoursRaw={venue?.hours_of_operation}
                timeZone={venue?.timezone}
                phone={venue?.phone}
                email={venue?.email}
                websiteUrl={venue?.website_url}
                description={
                  venue?.welcome_message ||
                  "Explore the possibilities of a connected pickleball venue: open play, coaching, competitions and a community that keeps everyone coming back."
                }
              />
              <section className="space-y-4 rounded-2xl border bg-card p-6">
                <h2 className="text-xl font-semibold">
                  A venue you can explore
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  This Rally Haus showcase uses the venue’s saved identity with
                  a fictional program lineup, example attendance and
                  illustrative photos. Browse freely, or sign in to try sample
                  reservations, RSVPs and voting.
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Demo interactions last while this page is open. They do not
                  create bookings, charge cards, notify players or change the
                  live venue.
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  For current venue information, use the saved website or open
                  the live venue.
                </p>
                {website && (
                  <Button
                    asChild
                    variant="outline"
                    className="min-h-11 rounded-xl"
                  >
                    <a href={website} target="_blank" rel="noopener noreferrer">
                      Venue website
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </section>
            </div>
            {gallery}
          </div>
        )}

        <footer className="mx-4 mt-8 border-t pt-5 text-xs leading-5 text-muted-foreground sm:mx-5">
          Rally Haus × PULSE · Demo programming and prices.{" "}
          <button
            type="button"
            onClick={() => setPhotoIndex(0)}
            className="min-h-11 underline underline-offset-4"
          >
            Photo credits
          </button>
        </footer>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) changeParams({ demoProgram: null });
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="px-6 pb-0 pt-6 pr-12">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {selected && categoryLabels[selected.category]} · Sample event
            </p>
            <DialogTitle className="text-2xl leading-tight">
              {selected?.title}
            </DialogTitle>
            <DialogDescription>
              Explore an example session at Rally Haus. Dates, prices and
              attendance are for demonstration.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <img
                src={demoPhotoUrl(selected.image)}
                alt={demoPhotos.find((p) => p.id === selected.image)?.alt || ""}
                width={720}
                height={320}
                className="aspect-[16/7] w-full object-cover"
              />
              <div className="space-y-5 px-6 pb-6">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p>
                    <CalendarDays className="mr-2 inline h-4 w-4 text-primary" />
                    {clubDate(selected.start, DEMO_TIME_ZONE, clock)} ·{" "}
                    {clubTime(selected.start, DEMO_TIME_ZONE)} ET
                  </p>
                  <p>
                    <Clock3 className="mr-2 inline h-4 w-4 text-primary" />
                    {selected.minutes} minutes
                  </p>
                  <p>
                    <Users className="mr-2 inline h-4 w-4 text-primary" />
                    {selected.level}
                  </p>
                  <p>
                    <MapPin className="mr-2 inline h-4 w-4 text-primary" />
                    {selected.courts} · Sample
                  </p>
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {selected.description}
                </p>
                <div>
                  <h3 className="text-sm font-semibold">What to expect</h3>
                  <ul className="mt-3 space-y-2">
                    {selected.includes.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {selected.price === 0 ? "Free" : `$${selected.price}`}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          sample{" "}
                          {selected.category === "league" ? "season" : "price"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.attending} / {selected.capacity} sample spots
                        filled
                      </p>
                    </div>
                    <span className="text-xs font-medium">
                      {selected.attending >= selected.capacity
                        ? "Waitlist available"
                        : `${
                            selected.capacity - selected.attending
                          } spots left`}
                    </span>
                  </div>
                  <Button
                    className="mt-4 min-h-12 w-full rounded-xl"
                    disabled={
                      !!responses[selected.key] ||
                      Date.parse(selected.end) <= clock.getTime()
                    }
                    onClick={() =>
                      interact("try a sample event RSVP", () =>
                        setResponses({
                          ...responses,
                          [selected.key]:
                            selected.attending >= selected.capacity
                              ? "waitlist"
                              : "going",
                        })
                      )
                    }
                  >
                    {responses[selected.key]
                      ? responses[selected.key] === "waitlist"
                        ? "On the demo waitlist"
                        : "Demo spot saved"
                      : Date.parse(selected.end) <= clock.getTime()
                      ? "Sample session ended"
                      : selected.attending >= selected.capacity
                      ? "Try joining the waitlist"
                      : "Try a sample RSVP"}
                  </Button>
                  {responses[selected.key] && (
                    <p role="status" className="mt-3 text-sm text-primary">
                      {responses[selected.key] === "waitlist"
                        ? "Sample waitlist joined."
                        : "Sample RSVP complete."}{" "}
                      No real registration was made.
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Demo only · No payment or real registration. Reset anytime.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={photoIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPhotoIndex(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedPhoto?.title}</DialogTitle>
            <DialogDescription>
              Illustrative photography ·{" "}
              {photoIndex === null ? 0 : photoIndex + 1} of {demoPhotos.length}
            </DialogDescription>
          </DialogHeader>
          {selectedPhoto && (
            <>
              <img
                src={demoPhotoUrl(selectedPhoto.id)}
                alt={selectedPhoto.alt}
                className="max-h-[58dvh] w-full rounded-xl object-contain"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Photo by{" "}
                  <a
                    className="underline"
                    href={`https://unsplash.com/photos/${selectedPhoto.source}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {selectedPhoto.author} / Unsplash
                  </a>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label="Previous photo"
                    onClick={() =>
                      setPhotoIndex(
                        (photoIndex! + demoPhotos.length - 1) %
                          demoPhotos.length
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label="Next photo"
                    onClick={() =>
                      setPhotoIndex((photoIndex! + 1) % demoPhotos.length)
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {photoCredit}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!gate}
        onOpenChange={(open) => {
          if (!open) setGate(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Join in with a free account</DialogTitle>
            <DialogDescription>
              Browse every sample event and photo freely. Sign in to try the
              interactive parts of this demo.
            </DialogDescription>
          </DialogHeader>
          <GuestAccountPrompt
            name={name}
            action={gate || "join in"}
            returnTo={`${location.pathname}${location.search}`}
          />
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => setGate(null)}
          >
            Keep exploring
          </Button>
        </DialogContent>
      </Dialog>
    </VenueTheme>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
        {label}
      </p>
    </div>
  );
}
function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-primary">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
      </div>
      {action && (
        <button
          onClick={onAction}
          className="flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
        >
          {action}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
function ProgramCard({
  session: s,
  onClick,
  compact,
  response,
}: {
  session: DemoSession;
  onClick: () => void;
  compact?: boolean;
  response?: "going" | "waitlist";
}) {
  const full = s.attending >= s.capacity;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        compact ? "flex items-stretch" : "flex flex-col"
      }`}
    >
      <img
        src={demoPhotoUrl(s.image)}
        alt=""
        loading="lazy"
        width={640}
        height={400}
        className={
          compact
            ? "w-24 shrink-0 object-cover sm:w-28"
            : "aspect-[16/10] w-full object-cover"
        }
      />
      <span className="flex min-w-0 flex-1 flex-col p-4">
        <span className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {categoryLabels[s.category]}
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            · Sample
          </span>
        </span>
        <span className="mt-2 block text-base font-semibold leading-6">
          {s.title}
        </span>
        <span className="mt-2 block text-xs leading-5 text-muted-foreground">
          {clubDate(s.start, DEMO_TIME_ZONE)} ·{" "}
          {clubTime(s.start, DEMO_TIME_ZONE)}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {s.level}
        </span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs">
          <span className="font-semibold">
            {s.price === 0 ? "Free" : `$${s.price}`}
            <span className="ml-1 font-normal text-muted-foreground">
              {s.category === "league" ? "/ season" : "/ person"}
            </span>
          </span>
          <span className={full ? "text-muted-foreground" : "text-primary"}>
            {response
              ? response === "waitlist"
                ? "Demo waitlist"
                : "Demo spot saved"
              : full
              ? "Full · Waitlist"
              : `${s.capacity - s.attending} ${
                  s.capacity - s.attending === 1 ? "spot" : "spots"
                } left`}
          </span>
        </span>
      </span>
    </button>
  );
}
