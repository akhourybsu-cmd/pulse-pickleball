import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ListChecks, CalendarDays, Trophy, ChevronRight, MapPin,
  Shuffle, Zap, Sparkles, Layers, KeyRound,
} from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import type { LeagueType } from "@/lib/leagues/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JoinByCodeDialog } from "@/components/leagues/JoinByCodeDialog";

const TYPE_META: Record<LeagueType, { stripe: string; icon: typeof Trophy; label: string }> = {
  singles:  { stripe: "bg-blue-500",    icon: Zap,      label: "Singles"  },
  doubles:  { stripe: "bg-emerald-500", icon: Shuffle,  label: "Doubles"  },
  team:     { stripe: "bg-primary",     icon: Trophy,   label: "Team"     },
  flex:     { stripe: "bg-amber-500",   icon: Sparkles, label: "Flex"     },
  ladder:   { stripe: "bg-violet-500",  icon: Layers,   label: "Ladder"   },
};

export default function PlayerLeagues() {
  const navigate = useNavigate();
  const { rows, loading, error } = useMyLeagues();
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
          <ListChecks className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight">My Leagues</h1>
          <p className="text-xs text-muted-foreground">
            Leagues you're actively part of
          </p>
        </div>
        <Button
          size="sm" variant="outline"
          onClick={() => setJoinOpen(true)}
          className="shrink-0"
        >
          <KeyRound className="w-4 h-4 mr-1.5" />
          Join with code
        </Button>
      </div>

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
            Got an invite code from an organizer? Enter it below to join.
            Otherwise, your leagues will appear here once an admin adds you.
          </p>
          <Button
            size="sm"
            onClick={() => setJoinOpen(true)}
            className="mt-4"
          >
            <KeyRound className="w-4 h-4 mr-1.5" />
            Enter invite code
          </Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ league, membership, season, division }) => {
            const meta = TYPE_META[league.league_type];
            const Icon = meta.icon;
            return (
              <li key={membership.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/player/leagues/${league.id}`)}
                  className="group w-full text-left rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="flex items-stretch">
                    <div className={cn("w-1.5 shrink-0", meta.stripe)} aria-hidden />
                    <div className="flex-1 min-w-0 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base truncate">
                              {league.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                              <Icon className="w-3 h-3" />
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
                              <>
                                <span>·</span>
                                <span className="uppercase tracking-wider text-[10px] font-bold text-primary">
                                  {membership.role}
                                </span>
                              </>
                            )}
                          </div>
                          {league.location && (
                            <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {league.location}
                            </div>
                          )}
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
      )}

      <JoinByCodeDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
