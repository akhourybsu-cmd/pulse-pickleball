import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays, Trophy, ChevronRight, MapPin,
  KeyRound, Plus, Archive,
} from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { useBrowseableLeagues } from "@/hooks/useBrowseableLeagues";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JoinByCodeDialog } from "@/components/leagues/JoinByCodeDialog";
import { CreateLeagueDialog } from "@/components/leagues/CreateLeagueDialog";
import { LeaguesExplainer } from "@/components/leagues/LeaguesExplainer";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { LeagueScope, LeagueTypeChip } from "@/components/leagues/_leagueScope";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SocialEmptyState, SocialHero } from "@/components/social/_shared";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TYPE_META = LEAGUE_TYPE_META;

export default function PlayerLeagues() {
  const navigate = useNavigate();
  const { rows, archivedRows, loading, error } = useMyLeagues();
  const { leagues: browseable, loading: browseLoading } = useBrowseableLeagues();
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
          { body: { session_id: sessionId } },
        );
        if (error) {
          toast.error(error.message ?? "Couldn't verify purchase");
        } else {
          const alreadyFulfilled = (data as { alreadyFulfilled?: boolean } | null)?.alreadyFulfilled;
          toast.success(alreadyFulfilled
            ? "Slot already granted — you're good to go."
            : "Slot unlocked! You can create another league now.");
        }
      }
      const next = new URLSearchParams(searchParams);
      next.delete("league_slot");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LeagueScope>
      <SocialHero eyebrow="Competition" title="Leagues">
        <p className="mt-2 max-w-md text-sm leading-snug text-muted-foreground">
          Own, play in, and manage your leagues from one place.
        </p>
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setJoinOpen(true)}
            className="h-11 rounded-xl border-border/70 bg-card/70 font-semibold active:scale-[0.98]"
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            Join with code
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-11 rounded-xl font-semibold btn-premium active:scale-[0.98]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create league
          </Button>
        </div>
      </SocialHero>

      <div className="container mx-auto max-w-3xl space-y-6 px-4 pb-10 pt-4 sm:px-6">

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 rounded-2xl bg-muted/50" />
            <div className="h-24 rounded-2xl bg-muted/50" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load leagues: {error}
          </div>
        ) : rows.length === 0 ? (
          <SocialEmptyState
            icon={Trophy}
            title="No leagues yet"
            description="Start your own league—your first one is free—or join an existing season with an invite code."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)} className="h-10 rounded-full">
                  <KeyRound className="mr-1.5 h-4 w-4" />Enter invite code
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="h-10 rounded-full btn-premium">
                  <Plus className="mr-1.5 h-4 w-4" />Create a league
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            <SectionHeader label="Your leagues" />
            <ul className="space-y-2.5">
              {rows.map(({ league, membership, season }, i) => {
                const isOrganizer = membership.role !== "player";
                return (
                  <motion.li
                    key={membership.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.04, ease: "easeOut" }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/player/leagues/${league.id}`)}
                      className="group w-full overflow-hidden text-left lg-card lg-card-hover transition-all hover:-translate-y-0.5 hover:border-[color:var(--lg-gold)]/50 active:translate-y-0 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none"
                    >
                      <div className="flex items-stretch">
                        {/* Gold bar if you organize, emerald if you play. */}
                        <div
                          className={cn(
                            "w-1.5 shrink-0",
                            isOrganizer
                              ? "bg-gradient-to-b from-[color:var(--lg-gold)]/40 via-[color:var(--lg-gold)] to-[color:var(--lg-gold)]/40"
                              : "bg-gradient-to-b from-[color:var(--lg-emerald)]/40 via-[color:var(--lg-emerald-bright)] to-[color:var(--lg-emerald)]/40",
                          )}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0 p-3.5 flex items-center gap-3">
                          <LeagueRowIcon type={league.league_type} isOrganizer={isOrganizer} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-base truncate text-[color:var(--lg-text)]">
                                {league.name}
                              </span>
                              <LeagueTypeChip type={league.league_type} />
                            </div>
                            <div className="text-xs text-[color:var(--lg-text-dim)] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {season && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {season.name}
                                </span>
                              )}
                              {isOrganizer && (
                                <span className="uppercase tracking-[0.14em] text-[10px] font-bold text-[color:var(--lg-accent-gold)] bg-[color:var(--lg-gold)]/10 px-1.5 py-0.5 rounded ring-1 ring-[color:var(--lg-gold)]/30">
                                  {membership.role}
                                </span>
                              )}
                            </div>
                            {league.location && (
                              <div className="text-[11px] text-[color:var(--lg-text-dim)] mt-1 inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {league.location}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-[color:var(--lg-text-dim)] shrink-0 group-hover:translate-x-0.5 group-hover:text-[color:var(--lg-accent-gold)] transition-all" />
                        </div>
                      </div>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ---------- Discover ---------- */}
        {!browseLoading && browseable.length > 0 && (
          <section className="pt-2">
            <SectionHeader label="Discover" />
            <p className="text-[11px] text-[color:var(--lg-text-dim)] -mt-1.5 mb-3">
              Public leagues you can join with an invite code
            </p>

            <ul className="space-y-2.5">
              {browseable.map((league) => {
                return (
                  <li key={league.id}>
                    <button
                      type="button"
                      onClick={() =>
                        league.invite_code
                          ? navigate(`/player/leagues/join/${league.invite_code}`)
                          : setJoinOpen(true)
                      }
                      className="group w-full overflow-hidden text-left opacity-90 lg-card lg-card-hover transition-all hover:-translate-y-0.5 hover:border-[color:var(--lg-gold)]/40 hover:opacity-100 active:translate-y-0 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none"
                    >
                      <div className="flex items-stretch">
                        <div className="w-1.5 shrink-0 bg-gradient-to-b from-transparent via-[color:var(--lg-emerald)] to-transparent opacity-60" aria-hidden />
                        <div className="flex-1 min-w-0 p-3.5 flex items-start gap-3">
                          <LeagueRowIcon type={league.league_type} isOrganizer={false} />
                          <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-base truncate text-[color:var(--lg-text)]">
                                  {league.name}
                                </span>
                                <LeagueTypeChip type={league.league_type} />
                              </div>
                              {league.description && (
                                <p className="text-xs text-[color:var(--lg-text-dim)] mt-1 line-clamp-2">
                                  {league.description}
                                </p>
                              )}
                              <div className="text-[11px] text-[color:var(--lg-text-dim)] mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {league.location && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {league.location}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 text-[color:var(--lg-accent-gold)] font-medium">
                                  <KeyRound className="w-3 h-3" />
                                  Join with code
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[color:var(--lg-text-dim)] shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:text-[color:var(--lg-accent-gold)] transition-all" />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ---------- Archived (collapsed by default) ---------- */}
        {!loading && archivedRows.length > 0 && (
          <section className="pt-2">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
              className="flex min-h-[64px] w-full items-center gap-3 px-3.5 py-3 text-left lg-card transition-[transform,border-color] hover:border-[color:var(--lg-gold)]/40 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
            >
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-[color:var(--lg-text-dim)]/10 text-[color:var(--lg-text-dim)] ring-1 ring-inset ring-[color:var(--lg-border)]">
                <Archive className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[color:var(--lg-text)]">
                  Archived leagues
                </div>
                <div className="text-[11px] text-[color:var(--lg-text-dim)]">
                  {archivedRows.length} finished {archivedRows.length === 1 ? "league" : "leagues"} — kept for records
                </div>
              </div>
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-[color:var(--lg-text-dim)] shrink-0 transition-transform",
                  showArchived && "rotate-90",
                )}
              />
            </button>

            {showArchived && (
              <ul className="space-y-2 mt-2">
                {archivedRows.map(({ league, membership, season }) => (
                  <li key={membership.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/player/leagues/${league.id}`)}
                      className="group w-full text-left lg-card lg-card-hover opacity-75 hover:opacity-100 transition-all overflow-hidden"
                    >
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-[color:var(--lg-text-dim)]/10 text-[color:var(--lg-text-dim)] ring-1 ring-inset ring-[color:var(--lg-border)]">
                          <Archive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate text-[color:var(--lg-text)]">
                              {league.name}
                            </span>
                            <LeagueTypeChip type={league.league_type} />
                          </div>
                          {season && (
                            <div className="text-[11px] text-[color:var(--lg-text-dim)] mt-0.5 inline-flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {season.name}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[color:var(--lg-text-dim)] shrink-0 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <LeaguesExplainer defaultOpen={!loading && rows.length === 0 && archivedRows.length === 0} />


        <JoinByCodeDialog
          open={joinOpen}
          onOpenChange={(o) => {
            setJoinOpen(o);
            if (!o) setPrefillCode(undefined);
          }}
          initialCode={prefillCode}
        />
        <CreateLeagueDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </div>
    </LeagueScope>
  );
}

function LeagueRowIcon({
  type, isOrganizer,
}: {
  type: import("@/lib/leagues/types").LeagueType;
  isOrganizer: boolean;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset transition-transform group-hover:scale-105",
        isOrganizer
          ? "bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-accent-gold)] ring-[color:var(--lg-gold)]/30"
          : "bg-[color:var(--lg-emerald)]/20 text-[color:var(--lg-emerald-bright)] ring-[color:var(--lg-emerald)]/40",
      )}
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}
