import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { League, LeagueType } from "@/lib/leagues/types";
import {
  CalendarDays, Users, UsersRound, CalendarClock,
  Trophy, MapPin, Shuffle, Layers, Sparkles, Zap,
} from "lucide-react";
import { OverviewTab } from "@/components/admin/leagues/OverviewTab";
import { SeasonsTab } from "@/components/admin/leagues/SeasonsTab";
import { DivisionsTab } from "@/components/admin/leagues/DivisionsTab";
import { MembersTab } from "@/components/admin/leagues/MembersTab";
import { TeamsTab } from "@/components/admin/leagues/TeamsTab";
import { SessionsTab } from "@/components/admin/leagues/SessionsTab";
import { MatchesTab } from "@/components/admin/leagues/MatchesTab";
import { AuditLogTab } from "@/components/admin/leagues/AuditLogTab";
import { cn } from "@/lib/utils";

interface Counts {
  seasons: number;
  members: number;
  teams: number;
  sessions: number;
}

export default function AdminLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<League | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  // Bumped on any mutation from any tab. Every tab subscribes to it so
  // creating a season in SeasonsTab immediately refreshes the season
  // dropdown in Divisions/Members/Teams/Sessions/Matches without a
  // manual reload. Also refetches hero counts.
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion((v) => v + 1);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !(await isPlatformAdmin(user.id))) {
        toast.error("Admin privileges required");
        navigate("/player/dashboard");
        return;
      }
      if (!leagueId) {
        navigate("/admin/leagues");
        return;
      }
      await refresh();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const refresh = async () => {
    if (!leagueId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leagues" as never)
      .select("*")
      .eq("id", leagueId)
      .maybeSingle();
    if (error || !data) {
      toast.error("League not found");
      navigate("/admin/leagues");
      return;
    }
    setLeague(data as unknown as League);
    await refetchCounts();
    setLoading(false);
  };

  // Counts-only refetch. Does NOT flip loading, so it can run silently
  // on any child-tab mutation without collapsing tab state.
  const refetchCounts = async () => {
    if (!leagueId) return;
    const [seasonsQ, membersQ, teamsQ, sessionsQ] = await Promise.all([
      supabase.from("league_seasons"  as never).select("id", { count: "exact", head: true }).eq("league_id", leagueId),
      supabase.from("league_members"  as never).select("id", { count: "exact", head: true }).eq("league_id", leagueId).eq("status", "active"),
      supabase.from("league_teams"    as never).select("id", { count: "exact", head: true }).eq("league_id", leagueId).eq("status", "active"),
      supabase.from("league_sessions" as never).select("id", { count: "exact", head: true }).eq("league_id", leagueId),
    ]);
    setCounts({
      seasons: seasonsQ.count ?? 0,
      members: membersQ.count ?? 0,
      teams: teamsQ.count ?? 0,
      sessions: sessionsQ.count ?? 0,
    });
  };

  // Every child mutation calls this. We bump the version signal (so
  // sibling tabs re-run their own reload) AND refetch hero counts.
  const onDataMutated = () => {
    bumpDataVersion();
    void refetchCounts();
  };

  if (loading || !league) {
    return (
      <AdminLayout title="League">
        <div className="container mx-auto px-4 py-10 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      </AdminLayout>
    );
  }

  const typeAccent = TYPE_META[league.league_type];
  const TypeIcon = typeAccent.icon;

  return (
    <AdminLayout title={league.name}>
      <div className="container mx-auto px-4 py-5 max-w-5xl space-y-5">
        {/* Sporty hero — dark gradient stadium vibe */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]">
          {/* Type-accent side stripe */}
          <div className={cn("absolute top-0 bottom-0 left-0 w-1.5", typeAccent.stripe)} aria-hidden />
          {/* Decorative diagonal stripes */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
               style={{
                 backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
                 color: "#A6DB5A",
               }}
               aria-hidden />

          <div className="relative p-5 sm:p-6">
            {/* Type + status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                typeAccent.pillBg,
              )}>
                <TypeIcon className="w-3 h-3" />
                {typeAccent.label}
              </span>
              <StatusPill status={league.status} />
              {league.rating_eligible && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30">
                  Rating-eligible
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                {league.visibility.replace("_", " ")}
              </span>
              {league.guests_allowed && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  · Guests allowed
                </span>
              )}
            </div>

            {/* Big league name */}
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

            {/* Summary stats — the "scoreboard" */}
            {counts && (
              <div className="mt-5 grid grid-cols-4 gap-3 pt-4 border-t border-slate-800">
                <HeroStat icon={<CalendarDays className="w-3.5 h-3.5" />} label="Seasons"  value={counts.seasons} />
                <HeroStat icon={<Users className="w-3.5 h-3.5" />}        label="Members"  value={counts.members} />
                <HeroStat icon={<UsersRound className="w-3.5 h-3.5" />}   label="Teams"    value={counts.teams} />
                <HeroStat icon={<CalendarClock className="w-3.5 h-3.5" />} label="Sessions" value={counts.sessions} />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="seasons">Seasons</TabsTrigger>
            <TabsTrigger value="divisions">Divisions</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <OverviewTab league={league} onRefresh={refresh} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="seasons" className="pt-4">
            <SeasonsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="divisions" className="pt-4">
            <DivisionsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="members" className="pt-4">
            <MembersTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="teams" className="pt-4">
            <TeamsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="sessions" className="pt-4">
            <SessionsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="matches" className="pt-4">
            <MatchesTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
          </TabsContent>
          <TabsContent value="audit" className="pt-4">
            <AuditLogTab league={league} dataVersion={dataVersion} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

/**
 * Big scoreboard-style stat callout. White numbers on the dark hero,
 * with an accent label above.
 */
function HeroStat({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-1 text-slate-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black tabular-nums mt-1 leading-none text-white">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: League["status"] }) {
  const tone =
    status === "active"
      ? "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30"
      : status === "archived"
      ? "bg-slate-600/30 text-slate-400 ring-1 ring-slate-500/30"
      : "bg-slate-700/50 text-slate-300 ring-1 ring-slate-600/50";
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded",
        tone,
      )}
    >
      {status}
    </span>
  );
}

/** Type-per-league accent used in the hero stripe + pill. */
const TYPE_META: Record<LeagueType, {
  stripe: string;
  pillBg: string;
  icon: typeof Trophy;
  label: string;
}> = {
  singles: {
    stripe: "bg-blue-500",
    pillBg: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
    icon: Zap,
    label: "Singles",
  },
  doubles: {
    stripe: "bg-emerald-500",
    pillBg: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    icon: Shuffle,
    label: "Doubles",
  },
  team: {
    stripe: "bg-[#A6DB5A]",
    pillBg: "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30",
    icon: Trophy,
    label: "Team",
  },
  flex: {
    stripe: "bg-amber-500",
    pillBg: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    icon: Sparkles,
    label: "Flex",
  },
  ladder: {
    stripe: "bg-violet-500",
    pillBg: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
    icon: Layers,
    label: "Ladder",
  },
};
