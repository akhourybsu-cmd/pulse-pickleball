import { useEffect, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { League } from "@/lib/leagues/types";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import {
  CalendarDays, Users, UsersRound, CalendarClock,
  Trophy, MapPin,
} from "lucide-react";
import { OverviewTab } from "@/components/admin/leagues/OverviewTab";
import { SeasonsTab } from "@/components/admin/leagues/SeasonsTab";
import { MembersTab } from "@/components/admin/leagues/MembersTab";
import { TeamsTab } from "@/components/admin/leagues/TeamsTab";
import { SubstitutesTab } from "@/components/admin/leagues/SubstitutesTab";
import { LadderTab } from "@/components/admin/leagues/LadderTab";
import { SessionsTab } from "@/components/admin/leagues/SessionsTab";
import { MatchesTab } from "@/components/admin/leagues/MatchesTab";
import { StandingsTab } from "@/components/admin/leagues/StandingsTab";
import { AuditLogTab } from "@/components/admin/leagues/AuditLogTab";
import {
  LeagueManageNav, type ManageTab, MANAGE_TABS,
} from "@/components/admin/leagues/LeagueManageNav";
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
  const location = useLocation();
  // The same component now backs BOTH /admin/leagues/:id (platform
  // admin surface with sidebar chrome) AND /player/leagues/:id/manage
  // (self-serve owner surface, no admin chrome). Detect by URL prefix
  // so we can wrap the render conditionally.
  const isPlayerContext = location.pathname.startsWith("/player/");
  // Leagues are one public portal now; both contexts return to it.
  const backHref = "/player/leagues";
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<League | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  // Bumped on any mutation from any tab. Every tab subscribes to it so
  // creating a season in SeasonsTab immediately refreshes the season
  // dropdown in Divisions/Members/Teams/Sessions/Matches without a
  // manual reload. Also refetches hero counts.
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion((v) => v + 1);
  const [activeTab, setActiveTab] = useState<ManageTab>("overview");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Should never happen — AuthGuard/AdminGuard wrap this route.
        // Bounce to home as a safety net.
        navigate("/");
        return;
      }
      if (!leagueId) {
        navigate(backHref);
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
    // No client-side admin gate — RLS decides. The row comes back only
    // when the caller is the league owner OR a platform admin (via
    // is_league_admin policy). An empty result means "not your league".
    const { data, error } = await supabase
      .from("leagues" as never)
      .select("*")
      .eq("id", leagueId)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    setLeague(data as unknown as League);
    setAccessDenied(false);
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

  // Shell wrapper — AdminLayout only inside /admin/*, else render
  // bare (PlayerShell above provides the surrounding chrome).
  const shell = (children: ReactNode, title = "League") =>
    isPlayerContext
      ? <>{children}</>
      : <AdminLayout title={title}>{children}</AdminLayout>;

  if (loading) {
    return shell(
      <div className="container mx-auto px-4 py-10 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (accessDenied || !league) {
    return shell(
      <div className="container mx-auto px-4 py-10 max-w-md text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Trophy className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">You don't have access</p>
        <p className="text-xs text-muted-foreground">
          This league is private, or you're not the owner or a member yet.
        </p>
        <button
          type="button"
          onClick={() => navigate(backHref)}
          className="text-xs text-primary hover:underline"
        >
          ← Back to My Leagues
        </button>
      </div>,
      "Access denied"
    );
  }

  const typeAccent = TYPE_META[league.league_type];
  const TypeIcon = typeAccent.icon;

  const activeTabDef = MANAGE_TABS.find((t) => t.key === activeTab);

  return shell(
    <>
      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-5">
        {/* Sporty hero — dark gradient stadium vibe */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]"
        >
          {/* Type-accent side stripe */}
          <div className={cn("absolute top-0 bottom-0 left-0 w-1.5", typeAccent.stripe)} aria-hidden />
          {/* Decorative diagonal stripes */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
               style={{
                 backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
                 color: "#A6DB5A",
               }}
               aria-hidden />
          <div aria-hidden className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#A6DB5A]/15 blur-3xl pointer-events-none" />

          <div className="relative p-5 sm:p-6">
            {/* Type + status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                typeAccent.pill,
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
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
                <HeroStat icon={<CalendarDays className="w-3.5 h-3.5" />} label="Seasons"  value={counts.seasons} />
                <HeroStat icon={<Users className="w-3.5 h-3.5" />}        label="Members"  value={counts.members} />
                <HeroStat icon={<UsersRound className="w-3.5 h-3.5" />}   label="Teams"    value={counts.teams} />
                <HeroStat icon={<CalendarClock className="w-3.5 h-3.5" />} label="Sessions" value={counts.sessions} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Two-column layout — nav rail on desktop, strip on mobile.
            The rail keeps activeTab state, the pane below animates
            when the caller switches. */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <LeagueManageNav active={activeTab} onChange={setActiveTab} />

          <div className="flex-1 min-w-0 space-y-3">
            {/* Section header — visible label above the pane so the
                mobile strip's active state is echoed here. */}
            {activeTabDef && (
              <div className="hidden lg:flex items-baseline gap-2 pb-1">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {activeTabDef.label}
                </h2>
                <span className="text-[11px] text-muted-foreground/70">
                  · {activeTabDef.hint}
                </span>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {activeTab === "overview" && (
                  <OverviewTab league={league} onRefresh={refresh} onMutated={onDataMutated} />
                )}
                {activeTab === "seasons" && (
                  <SeasonsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "members" && (
                  <MembersTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "teams" && (
                  <TeamsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "subs" && (
                  <SubstitutesTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "ladder" && (
                  <LadderTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "sessions" && (
                  <SessionsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "matches" && (
                  <MatchesTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "standings" && (
                  <StandingsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "audit" && (
                  <AuditLogTab league={league} dataVersion={dataVersion} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>,
    league.name
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

/** Type-per-league accent — sourced from the shared meta module. */
const TYPE_META = LEAGUE_TYPE_META;
