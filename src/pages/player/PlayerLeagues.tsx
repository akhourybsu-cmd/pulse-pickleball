import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ListChecks, CalendarDays, Trophy, ChevronRight, MapPin,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Shared meta module — one source of truth for label/icon/tones.
const TYPE_META = LEAGUE_TYPE_META;

export default function PlayerLeagues() {
  const navigate = useNavigate();
  const { rows, loading, error } = useMyLeagues();
  const { leagues: browseable, loading: browseLoading } = useBrowseableLeagues();
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillCode, setPrefillCode] = useState<string | undefined>(undefined);

  // Deep-link support: /player/leagues?join=SPRING26
  // Auto-open the dialog with the code pre-filled + auto-looked-up.
  // Strip the param after we've read it so a page refresh doesn't
  // keep re-opening the dialog.
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
  // Stripe returns to /player/leagues?league_slot=success&session_id=cs_...
  // We call verify-league-slot-purchase to idempotently grant the slot,
  // then strip the params so a refresh doesn't re-fire.
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
      // Strip either flavor of param so refresh doesn't re-fire.
      const next = new URLSearchParams(searchParams);
      next.delete("league_slot");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      {/* Premium hero — dark gradient with the PULSE gold eyebrow.
          Sets the tone the rest of the surface plays off. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38] p-5 sm:p-6"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
            color: "#A6DB5A",
          }}
        />
        {/* Soft accent glow + oversized trophy watermark for depth */}
        <div
          aria-hidden
          className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-[#A6DB5A]/20 blur-3xl pointer-events-none"
        />
        <Trophy
          aria-hidden
          className="absolute -right-4 -bottom-8 h-40 w-40 text-white/[0.03] rotate-12 pointer-events-none"
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#A6DB5A]/15 text-[#A6DB5A] text-[10px] font-bold uppercase tracking-wider ring-1 ring-[#A6DB5A]/30">
              <Trophy className="w-3 h-3" />
              League Play
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              My Leagues
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-md">
              Leagues you own, play in, or captain — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm" variant="outline"
              onClick={() => setJoinOpen(true)}
              className="bg-slate-900/60 border-slate-700 text-slate-100 hover:bg-slate-800 hover:text-white"
            >
              <KeyRound className="w-4 h-4 mr-1.5" />
              Join
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-[#A6DB5A] text-[#0B171F] hover:bg-[#A6DB5A]/90 font-semibold shadow-[0_2px_8px_-2px_rgba(166,219,90,0.5)]"
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
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold">No leagues yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Start your own league — your first one's free — or join an
            existing one with an invite code.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create a league
            </Button>
            <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>
              <KeyRound className="w-4 h-4 mr-1.5" />
              Enter invite code
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ league, membership, season, division }, i) => {
            const meta = TYPE_META[league.league_type];
            const Icon = meta.icon;
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
                  className="group w-full text-left rounded-2xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 active:scale-[0.99] transition-all overflow-hidden"
                >
                  <div className="flex items-stretch">
                    <div className={cn("w-1.5 shrink-0 bg-gradient-to-b from-transparent via-current to-transparent opacity-80", meta.stripe)} aria-hidden />
                    <div className="flex-1 min-w-0 p-3.5 flex items-center gap-3">
                      {/* Type-accent icon chip — the visual anchor */}
                      <div className={cn(
                        "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset ring-border/50 transition-transform group-hover:scale-105",
                        meta.chip,
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base truncate">
                            {league.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {season && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {season.name}
                            </span>
                          )}
                          {division && (<><span>·</span><span>{division.name}</span></>)}
                          {membership.role !== "player" && (
                            <span className="uppercase tracking-wider text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded ring-1 ring-primary/20">
                              {membership.role}
                            </span>
                          )}
                        </div>
                        {league.location && (
                          <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {league.location}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                    </div>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* ---------- Discover ---------- */}
      {/* Self-hides when there's nothing public to join yet — no point
          showing "Discover 0 leagues" until admins flip visibility on
          real leagues. Loading state also hides so the section only
          appears once we know it has content. */}
      {!browseLoading && browseable.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-t border-border/60 pt-4">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Discover
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Public leagues you can join with an invite code
              </p>
            </div>
          </div>

          <ul className="space-y-2.5">
            {browseable.map((league) => {
              const meta = TYPE_META[league.league_type];
              const Icon = meta.icon;
              return (
                <li key={league.id}>
                  <button
                    type="button"
                    onClick={() => setJoinOpen(true)}
                    className="group w-full text-left rounded-2xl border border-border/70 bg-card/50 hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      <div className={cn("w-1.5 shrink-0 bg-gradient-to-b from-transparent via-current to-transparent opacity-60", meta.stripe)} aria-hidden />
                      <div className="flex-1 min-w-0 p-3.5 flex items-start gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset ring-border/50",
                          meta.chip,
                        )}>
                          <Icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-base truncate">
                                {league.name}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {meta.label}
                              </span>
                            </div>
                            {league.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {league.description}
                              </p>
                            )}
                            <div className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {league.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {league.location}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-primary/80 font-medium">
                                <KeyRound className="w-3 h-3" />
                                Join with code
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
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

      {/* Plain-language explainer — auto-opens for first-timers, stays
          collapsed (but handy) once you're in a league. */}
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
  );
}
