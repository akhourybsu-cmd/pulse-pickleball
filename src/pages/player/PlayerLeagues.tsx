import { playerLeaguePath, leagueInvitePath } from "@/lib/leagues/playerNavigation";
import { useTheme } from 'next-themes';
import { leagueBrandStyle } from '@/lib/leagues/branding';
import { LeagueBrandMark } from '@/components/leagues/LeagueIdentity';
import { VenueCoverImage } from '@/components/venue/VenueCoverImage';
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Trophy,
  ChevronRight,
  MapPin,
  KeyRound,
  Plus,
  Archive,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { useBrowseableLeagues } from "@/hooks/useBrowseableLeagues";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JoinByCodeDialog } from "@/components/leagues/JoinByCodeDialog";
import { CreateLeagueDialog } from "@/components/leagues/CreateLeagueDialog";
import { LeaguesExplainer } from "@/components/leagues/LeaguesExplainer";
import { LeagueScope, LeagueTypeChip } from "@/components/leagues/_leagueScope";
import { SocialEmptyState } from "@/components/social/_shared";
import { supabase } from "@/integrations/supabase/client";
import { PlayerLeagueStage } from "@/components/leagues/PlayerLeagueStage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type { League, LeagueSeason } from "@/lib/leagues/types";
import { toast } from "sonner";


export default function PlayerLeagues() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { rows, archivedRows, loading, error } = useMyLeagues();
  const {
    leagues: browseable,
    loading: browseLoading,
    error: browseError,
  } = useBrowseableLeagues();
  const [query, setQuery] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [prefillCode, setPrefillCode] = useState<string | undefined>(undefined);

  // Deep-link support: /player/leagues?join=SPRING26
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const code = searchParams.get("join");
    if (!code) return;
    setPrefillCode(code);
    setJoinOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("join");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // League-slot purchase redirect handler.
  useEffect(() => {
    const status = searchParams.get("league_slot");
    if (!status) return;
    const sessionId = searchParams.get("session_id");
    (async () => {
      if (status === "canceled") {
        toast.info("Purchase canceled — no charge made.");
      } else if (status === "success" && sessionId) {
        const { data, error } = await supabase.functions.invoke(
          "verify-league-slot-purchase",
          { body: { session_id: sessionId } }
        );
        if (error) {
          toast.error(error.message ?? "Couldn't verify purchase");
        } else {
          const alreadyFulfilled = (
            data as { alreadyFulfilled?: boolean } | null
          )?.alreadyFulfilled;
          toast.success(
            alreadyFulfilled
              ? "Slot already granted — you're good to go."
              : "Slot unlocked! You can create another league now."
          );
        }
      }
      const next = new URLSearchParams(searchParams);
      next.delete("league_slot");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchesSearch = (league: League) =>
    `${league.name} ${league.location ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  const visibleRows = rows.filter((row) => matchesSearch(row.league));
  const visiblePublic = browseable.filter(matchesSearch);

  return (
    <LeagueScope className="league-player">
      <div className="container mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-6 sm:py-8">
        <PlayerLeagueStage
          title="Your game. Your league."
          description="Find your people. Build your season. Make every game count."
        >
          <Button
            onClick={() => setJoinOpen(true)}
            className="h-12 rounded-xl bg-[#dfbd73] px-5 font-bold text-[#1c241f] hover:bg-[#eacf95]"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Join with code
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreateOpen(true)}
            className="h-12 rounded-xl border-white/30 bg-white/5 px-5 text-white hover:bg-white/15 hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create league
          </Button>
        </PlayerLeagueStage>

        <Tabs defaultValue="mine">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <TabsList
              aria-label="Find leagues"
              className="h-auto gap-1 rounded-xl bg-muted/70 p-1"
            >
              <TabsTrigger
                value="mine"
                className="min-h-11 gap-2 rounded-lg px-4"
              >
                My leagues
                {!loading && (
                  <span className="rounded-md bg-primary/15 px-1.5 text-xs">
                    {rows.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="discover"
                className="min-h-11 rounded-lg px-4"
              >
                Discover
              </TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Search leagues"
                placeholder="Search by league or location"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 rounded-xl bg-card pl-10"
              />
            </div>
          </div>
          <TabsContent value="mine" className="league-player-panel space-y-6">
            {loading ? (
              <div role="status" className="grid gap-4 md:grid-cols-2">
                <span className="sr-only">Loading your leagues…</span>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="h-60 rounded-3xl bg-muted/50 motion-safe:animate-pulse"
                  />
                ))}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                Couldn't load leagues: {error}
              </div>
            ) : !rows.length ? (
              <SocialEmptyState
                icon={Trophy}
                title="Your season starts here"
                description="Join your friends with an invite code, or create a league and bring your own competition."
                action={
                  <Button
                    onClick={() => setJoinOpen(true)}
                    className="min-h-11 rounded-xl"
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Enter invite code
                  </Button>
                }
              />
            ) : !visibleRows.length ? (
              <p
                role="status"
                className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground"
              >
                No leagues match “{query}”. Try another name or location.
              </p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {visibleRows.map(
                  ({ league, membership, season, isSubstitute }, i) => (
                    <motion.li
                      key={membership.id}
                      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.3,
                        delay: reducedMotion ? 0 : Math.min(i, 5) * 0.04,
                      }}
                    >
                      <LeagueTicket
                        league={league}
                        season={season}
                        role={isSubstitute ? "Substitute" : membership.role}
                        onClick={() => navigate(playerLeaguePath(league.id, season?.id))}
                      />
                    </motion.li>
                  )
                )}
              </ul>
            )}
            {!loading && archivedRows.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowArchived((value) => !value)}
                  aria-expanded={showArchived}
                  aria-controls="archived-league-list"
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left text-sm font-semibold"
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  Previous seasons
                  <span className="text-muted-foreground">
                    {archivedRows.length}
                  </span>
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 transition-transform",
                      showArchived && "rotate-90"
                    )}
                  />
                </button>
                {showArchived && (
                  <ul
                    id="archived-league-list"
                    className="mt-3 grid gap-3 md:grid-cols-2"
                  >
                    {archivedRows
                      .filter((row) => matchesSearch(row.league))
                      .map(({ league, membership, season }) => (
                        <li key={membership.id}>
                          <LeagueTicket
                            league={league}
                            season={season}
                            role="Archived"
                            onClick={() =>
                              navigate(playerLeaguePath(league.id, season?.id))
                            }
                          />
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )}
          </TabsContent>
          <TabsContent
            value="discover"
            className="league-player-panel space-y-4"
          >
            <div>
              <h2 className="font-display text-xl">Find your next rivalry</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Explore public leagues and join with an organizer’s invite code.
              </p>
            </div>
            {browseLoading ? (
              <p role="status" className="p-8 text-sm text-muted-foreground">
                Finding leagues…
              </p>
            ) : browseError ? (
              <p
                role="alert"
                className="rounded-2xl border border-destructive/30 p-5 text-sm text-destructive"
              >
                Couldn’t load public leagues. Please try again later.
              </p>
            ) : visiblePublic.length ? (
              <ul className="grid gap-4 md:grid-cols-2">
                {visiblePublic.map((league) => (
                  <li key={league.id}>
                    <LeagueTicket
                      league={league}
                      discover
                      onClick={() =>
                        league.invite_code
                          ? navigate(
                              leagueInvitePath(league.invite_code)
                            )
                          : setJoinOpen(true)
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <SocialEmptyState
                icon={Search}
                title={
                  query ? "No matching leagues" : "More competition is coming"
                }
                description={
                  query
                    ? "Try another league name or location."
                    : "Public leagues will appear here. Have an invite? You can join with a code anytime."
                }
              />
            )}
          </TabsContent>
        </Tabs>
        <LeaguesExplainer
          defaultOpen={
            !loading && rows.length === 0 && archivedRows.length === 0
          }
        />
        <JoinByCodeDialog
          open={joinOpen}
          onOpenChange={(open) => {
            setJoinOpen(open);
            if (!open) setPrefillCode(undefined);
          }}
          initialCode={prefillCode}
        />
        <CreateLeagueDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </LeagueScope>
  );
}

export function LeagueTicket({
  league,
  season,
  role,
  discover,
  onClick,
}: {
  league: League;
  season?: LeagueSeason | null;
  role?: string;
  discover?: boolean;
  onClick: () => void;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <button type="button" className="league-ticket group" style={leagueBrandStyle(league.branding, resolvedTheme === "dark")} onClick={onClick}>
      {league.branding?.cover_url && <div className="relative h-24 overflow-hidden"><VenueCoverImage src={league.branding.cover_url} crop={league.branding.cover_crop} /></div>}
      <div className="league-ticket-banner flex items-center justify-between gap-2">
        <LeagueTypeChip type={league.league_type} />
        <span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
          {role ?? "Open to discover"}
        </span>
      </div>
      <div className="flex flex-1 items-start gap-4 p-5 sm:p-6">
        <LeagueBrandMark name={league.name} branding={league.branding} className="h-14 w-14 text-[56px]" />
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold leading-snug">
            {league.name}
          </h2>
          {season && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{season.name}</span>
            </p>
          )}
          {discover && league.description && (
            <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">
              {league.description}
            </p>
          )}
          {league.location && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{league.location}</span>
            </p>
          )}
        </div>
      </div>
      <div className="league-ticket-footer">
        <span>
          {discover
            ? "View invitation"
            : role === "Archived"
              ? "Revisit your season"
              : "Enter league"}
        </span>
        <ArrowUpRight
          className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </button>
  );
}
