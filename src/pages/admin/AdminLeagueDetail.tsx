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
import { DivisionsTab } from "@/components/admin/leagues/DivisionsTab";
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
      // Roster count excludes the auto-enrolled manager row (season-less,
      // role='manager'). Managers are only counted here if they've also
      // been added as a player/captain/sub in a season — a separate row.
      supabase.from("league_members"  as never).select("id", { count: "exact", head: true }).eq("league_id", leagueId).eq("status", "active").neq("role", "manager"),
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
    <div className="league-admin bg-[color:var(--lg-bg)] min-h-screen">
      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-5">
        {/* Emerald Prestige hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-xl border border-[color:var(--lg-border)] lg-hero-gradient shadow-[inset_0_1px_0_0_rgba(201,168,76,0.15)]"
        >
          {/* Diagonal court-line texture */}
          <div className="absolute inset-0 lg-court-lines pointer-events-none" aria-hidden />
          {/* Gold hairline at top */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color:var(--lg-gold)]/60 to-transparent" aria-hidden />

          <div className="relative p-6 sm:p-8">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-gold-bright)] ring-1 ring-[color:var(--lg-gold)]/40">
                <TypeIcon className="w-3 h-3" />
                {typeAccent.label}
              </span>
              <StatusPill status={league.status} />
              {league.rating_eligible && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--lg-gold)] ring-1 ring-[color:var(--lg-gold)]/50">
                  Rating-eligible
                </span>
              )}
              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[color:var(--lg-text-dim)]">
                {league.visibility.replace("_", " ")}
              </span>
              {league.guests_allowed && (
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[color:var(--lg-text-dim)]">
                  · Guests allowed
                </span>
              )}
            </div>

            {/* League title */}
            <h1 className="font-display mt-4 text-5xl sm:text-6xl leading-[0.95] text-[color:var(--lg-text)]">
              {league.name.toUpperCase()}
            </h1>

            {league.description && (
              <p className="text-[color:var(--lg-text-dim)] text-sm mt-3 max-w-2xl leading-relaxed">
                {league.description}
              </p>
            )}

            {league.location && (
              <div className="text-xs text-[color:var(--lg-text-dim)] mt-3 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {league.location}
              </div>
            )}

            {/* KPI scoreboard */}
            {counts && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-[color:var(--lg-gold)]/25 divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--lg-gold)]/20">
                <HeroStat icon={<CalendarDays className="w-3.5 h-3.5" />}    label="Seasons"  value={counts.seasons} />
                <HeroStat icon={<Users className="w-3.5 h-3.5" />}           label="Roster"   value={counts.members} />
                <HeroStat icon={<UsersRound className="w-3.5 h-3.5" />}      label="Teams"    value={counts.teams} />
                <HeroStat icon={<CalendarClock className="w-3.5 h-3.5" />}   label="Sessions" value={counts.sessions} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Rail + workspace */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <LeagueManageNav active={activeTab} onChange={setActiveTab} />

          <div className="flex-1 min-w-0 space-y-3">
            {activeTabDef && (
              <div className="hidden lg:flex items-baseline gap-2 pb-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--lg-gold)]/80">
                  Managing
                </div>
                <h2 className="font-display text-lg leading-none text-[color:var(--lg-text)]">
                  {activeTabDef.label.toUpperCase()}
                </h2>
                <span className="text-[11px] text-[color:var(--lg-text-dim)]/80">
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
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {activeTab === "overview" && (
                  <OverviewTab league={league} onRefresh={refresh} onMutated={onDataMutated} />
                )}
                {activeTab === "seasons" && (
                  <SeasonsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "divisions" && (
                  <DivisionsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
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
    </div>,
    league.name
  );
}

/**
 * Scoreboard-style hero stat. Bebas numeral over uppercase label.
 */
function HeroStat({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-start px-4 py-4 first:pl-0">
      <div className="flex items-center gap-1.5 text-[color:var(--lg-gold)]/85">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold">{label}</span>
      </div>
      <div className="lg-num text-4xl sm:text-5xl mt-1 leading-none text-[color:var(--lg-text)]">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: League["status"] }) {
  const tone =
    status === "active"
      ? "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)] ring-1 ring-[color:var(--lg-emerald)]/50"
      : status === "archived"
      ? "bg-white/5 text-[color:var(--lg-text-dim)] ring-1 ring-white/10"
      : "bg-white/8 text-[color:var(--lg-text-dim)] ring-1 ring-white/15";
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded",
        tone,
      )}
    >
      {status}
    </span>
  );
}

/** Type-per-league accent — sourced from the shared meta module. */
const TYPE_META = LEAGUE_TYPE_META;
