import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MapPin, Trophy, Shuffle, Zap, Sparkles, Layers,
  CalendarDays, Users, UsersRound,
} from "lucide-react";
import type {
  League, LeagueMember, LeagueSeason, LeagueDivision, LeagueTeam,
  LeagueType,
} from "@/lib/leagues/types";
import { cn } from "@/lib/utils";

const TYPE_META: Record<LeagueType, { stripe: string; pill: string; icon: typeof Trophy; label: string }> = {
  singles: {
    stripe: "bg-blue-500",
    pill: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
    icon: Zap, label: "Singles",
  },
  doubles: {
    stripe: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    icon: Shuffle, label: "Doubles",
  },
  team: {
    stripe: "bg-[#A6DB5A]",
    pill: "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30",
    icon: Trophy, label: "Team",
  },
  flex: {
    stripe: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    icon: Sparkles, label: "Flex",
  },
  ladder: {
    stripe: "bg-violet-500",
    pill: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
    icon: Layers, label: "Ladder",
  },
};

export default function PlayerLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<League | null>(null);
  const [membership, setMembership] = useState<LeagueMember | null>(null);
  const [season, setSeason] = useState<LeagueSeason | null>(null);
  const [division, setDivision] = useState<LeagueDivision | null>(null);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // RLS ensures we only get the league if we can view it.
      const { data: leagueData } = await supabase
        .from("leagues" as never)
        .select("*").eq("id", leagueId).maybeSingle();
      if (!leagueData) {
        // Either doesn't exist, is admin_only, or user isn't a member.
        if (!cancelled) { setLeague(null); setLoading(false); }
        return;
      }
      const l = leagueData as unknown as League;

      const [{ data: memRow }, { data: teamsData }] = await Promise.all([
        supabase.from("league_members" as never).select("*")
          .eq("league_id", l.id).eq("user_id", user.id).eq("status", "active")
          .maybeSingle(),
        // Player-scoped team policy — this returns only teams the user
        // is on/captains. Others are invisible.
        supabase.from("league_teams" as never).select("*")
          .eq("league_id", l.id),
      ]);
      const m = (memRow ?? null) as unknown as LeagueMember | null;

      let s: LeagueSeason | null = null;
      let d: LeagueDivision | null = null;
      if (m?.season_id) {
        const { data } = await supabase.from("league_seasons" as never)
          .select("*").eq("id", m.season_id).maybeSingle();
        s = (data ?? null) as unknown as LeagueSeason | null;
      }
      if (m?.division_id) {
        const { data } = await supabase.from("league_divisions" as never)
          .select("*").eq("id", m.division_id).maybeSingle();
        d = (data ?? null) as unknown as LeagueDivision | null;
      }

      if (!cancelled) {
        setLeague(l);
        setMembership(m);
        setSeason(s);
        setDivision(d);
        setTeams((teamsData ?? []) as unknown as LeagueTeam[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leagueId, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-10 text-center max-w-md">
        <p className="text-sm font-medium">League not available</p>
        <p className="text-xs text-muted-foreground mt-1">
          This league might have ended or your membership isn't active.
        </p>
        <Button
          size="sm" variant="outline" className="mt-4"
          onClick={() => navigate("/player/leagues")}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to my leagues
        </Button>
      </div>
    );
  }

  const meta = TYPE_META[league.league_type];
  const Icon = meta.icon;

  return (
    <div className="container mx-auto px-4 py-5 max-w-3xl space-y-4">
      <Button
        variant="ghost" size="sm" onClick={() => navigate("/player/leagues")}
        className="-ml-2 h-8"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        My leagues
      </Button>

      {/* Sporty hero — same visual language as the admin detail page */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]">
        <div className={cn("absolute top-0 bottom-0 left-0 w-1.5", meta.stripe)} aria-hidden />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{
               backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
               color: "#A6DB5A",
             }}
             aria-hidden />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
              meta.pill,
            )}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>
            {membership && membership.role !== "player" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30">
                You're {membership.role}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {league.name}
          </h1>
          {league.description && (
            <p className="text-slate-400 text-sm mt-2 max-w-2xl">
              {league.description}
            </p>
          )}
          {league.location && (
            <div className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {league.location}
            </div>
          )}
        </div>
      </div>

      {/* My info card */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Your spot in this league
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow
            icon={<CalendarDays className="w-4 h-4" />}
            label="Season"
            value={season?.name ?? "Not assigned"}
          />
          <InfoRow
            icon={<Users className="w-4 h-4" />}
            label="Division"
            value={division?.name ?? "Not assigned"}
          />
          <InfoRow
            icon={<Trophy className="w-4 h-4" />}
            label="Role"
            value={membership?.role ?? "player"}
          />
          <InfoRow
            icon={<UsersRound className="w-4 h-4" />}
            label="Teams"
            value={teams.length === 0
              ? "Not on a team yet"
              : teams.map((t) => t.name).join(", ")}
          />
        </div>
      </div>

      {/* Placeholder for future: match schedule, standings */}
      <div className="rounded-xl border border-dashed border-border p-5 text-center">
        <p className="text-xs text-muted-foreground">
          Match schedules and standings will appear here as league play
          begins.
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
