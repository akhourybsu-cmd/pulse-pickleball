import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays, Trophy, ChevronRight, MapPin,
  KeyRound, Plus, Sparkles,
} from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { useBrowseableLeagues } from "@/hooks/useBrowseableLeagues";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JoinByCodeDialog } from "@/components/leagues/JoinByCodeDialog";
import { CreateLeagueDialog } from "@/components/leagues/CreateLeagueDialog";
import { LeaguesExplainer } from "@/components/leagues/LeaguesExplainer";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { LeagueScope, LeagueTypeChip, LgSectionHeader } from "@/components/leagues/_leagueScope";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TYPE_META = LEAGUE_TYPE_META;

export default function PlayerLeagues() {
  const navigate = useNavigate();
  const { rows, loading, error } = useMyLeagues();
  const { leagues: browseable, loading: browseLoading } = useBrowseableLeagues();
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
      <div className="container mx-auto px-4 py-5 max-w-2xl space-y-5">
        {/* Emerald Prestige hero — matches the organizer console. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-xl border border-[color:var(--lg-border)] lg-hero-gradient shadow-[inset_0_1px_0_0_var(--lg-inset)]"
        >
          <div className="absolute inset-0 lg-court-lines pointer-events-none" aria-hidden />
          <div className="absolute top-0 left-0 right-0 h-px lg-hairline" aria-hidden />
          <Trophy
            aria-hidden
            className="absolute -right-4 -bottom-8 h-40 w-40 text-[color:var(--lg-gold)]/10 rotate-12 pointer-events-none"
          />

          <div className="relative p-5 sm:p-6 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[color:var(--lg-hero-chip-bg)] text-[color:var(--lg-hero-gold)] text-[10px] font-bold uppercase tracking-[0.16em] ring-1 ring-[color:var(--lg-hero-chip-ring)]">
                <Trophy className="w-3 h-3" />
                League Play
              </div>
              <h1 className="font-display mt-3 text-3xl sm:text-4xl leading-[1] text-[color:var(--lg-hero-text)]">
                MY LEAGUES
              </h1>
              <p className="text-[color:var(--lg-hero-text-dim)] text-sm mt-2 max-w-md">
                Leagues you own, play in, or captain — all in one place.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm" variant="outline"
                onClick={() => setJoinOpen(true)}
                className="border-[color:var(--lg-hero-gold)]/60 bg-transparent text-[color:var(--lg-hero-gold)] hover:bg-white/10 hover:text-[color:var(--lg-hero-gold)]"
              >
                <KeyRound className="w-4 h-4 mr-1.5" />
                Join
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="bg-[color:var(--lg-emerald)] text-[color:var(--lg-gold-soft)] hover:bg-[color:var(--lg-emerald-bright)] font-semibold shadow-[0_2px_8px_-2px_rgba(13,122,95,0.6)] ring-1 ring-[color:var(--lg-gold)]/40"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create
              </Button>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-24 rounded-xl bg-muted/50" />
            <div className="h-24 rounded-xl bg-muted/50" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load leagues: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="lg-card p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--lg-emerald)]/20 text-[color:var(--lg-accent-gold)] ring-1 ring-[color:var(--lg-gold)]/30">
              <Trophy className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[color:var(--lg-text)]">No leagues yet</p>
            <p className="text-xs text-[color:var(--lg-text-dim)] mt-1 max-w-sm mx-auto">
              Start your own league — your first one's free — or join an
              existing one with an invite code.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <Button size="sm" onClick={() => setCreateOpen(true)}
                className="bg-[color:var(--lg-emerald)] text-[color:var(--lg-gold-soft)] hover:bg-[color:var(--lg-emerald-bright)]">
                <Plus className="w-4 h-4 mr-1.5" />
                Create a league
              </Button>
              <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}
                className="border-[color:var(--lg-gold)]/50 text-[color:var(--lg-accent-gold)] hover:bg-[color:var(--lg-gold)]/10">
                <KeyRound className="w-4 h-4 mr-1.5" />
                Enter invite code
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <LgSectionHeader>Your Leagues</LgSectionHeader>
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
                      className="group w-full text-left lg-card lg-card-hover hover:border-[color:var(--lg-gold)]/50 hover:-translate-y-0.5 active:scale-[0.99] transition-all overflow-hidden"
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
            <LgSectionHeader icon={Sparkles}>Discover</LgSectionHeader>
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
                      className="group w-full text-left lg-card lg-card-hover opacity-90 hover:opacity-100 hover:border-[color:var(--lg-gold)]/40 hover:-translate-y-0.5 transition-all overflow-hidden"
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

        <LeaguesExplainer defaultOpen={!loading && rows.length === 0} />

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
