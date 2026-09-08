import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { League } from "@/lib/leagues/types";
import {
  CalendarDays, Users, UsersRound, CalendarClock,
  Trophy,
  ArrowLeft, ExternalLink,
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
import { LeagueSetupChecklist } from "@/components/admin/leagues/LeagueSetupChecklist";
import { LeagueManageNav } from "@/components/admin/leagues/LeagueManageNav";
import { type ManageTab, MANAGE_TABS, visibleManageTabs } from "@/components/admin/leagues/leagueManageTabs";
import { LeagueScope, LeagueHero } from "@/components/leagues/_leagueScope";
import { DUR, EASE_OUT, contentVariants } from "@/lib/leagues/motion";
import { useLeagueLiveRefresh } from '@/hooks/useLeagueLiveRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useLeagueActions } from '@/hooks/useLeagueActions';
import { ActionsTab } from '@/components/admin/leagues/ActionsTab';

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
  const [managerName, setManagerName] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Bumped on any mutation from any tab. Every tab subscribes to it so
  // creating a season in SeasonsTab immediately refreshes the season
  // dropdown in Divisions/Members/Teams/Sessions/Matches without a
  // manual reload. Also refetches hero counts.
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion((v) => v + 1);
  useLeagueLiveRefresh(leagueId, () => {
    bumpDataVersion();
    void queryClient.invalidateQueries({ queryKey: ['league-sub-requests'] });
  });
  const actions = useLeagueActions(leagueId, !!league && !accessDenied && !loading, dataVersion);

  // Active tab is synced to the URL (?tab=…) so a refresh keeps your place and
  // organizers can share a link straight to a section. Unknown values fall
  // back to Actions; the type-validity guard below handles hidden tabs.
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get("tab");
  const activeTab: ManageTab =
    paramTab && MANAGE_TABS.some((t) => t.key === paramTab)
      ? (paramTab as ManageTab)
      : "actions";
  const setActiveTab = useCallback((t: ManageTab) => {
    if (t === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next);
  }, [activeTab, searchParams, setSearchParams]);

  // Direction for the tab-content transition: forward (right) when moving
  // to a later tab in canonical order, backward (left) otherwise. Tracked
  // on a ref so computing it never triggers a re-render.
  const reducedMotion = useReducedMotion();
  const activeIndex = MANAGE_TABS.findIndex((t) => t.key === activeTab);
  const prevIndexRef = useRef(activeIndex);
  const tabDir = reducedMotion
    ? 0
    : activeIndex > prevIndexRef.current ? 1
    : activeIndex < prevIndexRef.current ? -1
    : 0;
  useEffect(() => {
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Only the tabs that make sense for this league's setup (ladder vs manual).
  const visibleTabs = useMemo(
    () => (league ? visibleManageTabs(league.league_type) : MANAGE_TABS),
    [league],
  );
  // If the current tab isn't valid for this league type, fall back to Actions.
  useEffect(() => {
    if (league && !visibleTabs.some((t) => t.key === activeTab)) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "actions");
      setSearchParams(next, { replace: true });
    }
  }, [league, visibleTabs, activeTab, searchParams, setSearchParams]);

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
    setLoadError(null);
    // No client-side admin gate — RLS decides. The row comes back only
    // when the caller is the league owner OR a platform admin (via
    // is_league_admin policy). An empty result means "not your league".
    const { data, error } = await supabase
      .from("leagues" as never)
      .select("*")
      .eq("id", leagueId)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    // SELECT visibility also includes ordinary members and public leagues;
    // it is never evidence that someone has organizer privileges.
    const permission = await supabase.rpc('is_league_admin' as never, { p_league_id: leagueId } as never);
    if (permission.error || permission.data !== true) {
      setLeague(null);
      setAccessDenied(!permission.error);
      setLoadError(permission.error?.message ?? null);
      setLoading(false);
      return;
    }
    setLeague(data as unknown as League);
    setAccessDenied(false);
    // Fetch manager (creator) display name for the hero banner. Non-fatal
    // if it fails or the profile is not visible.
    const createdBy = (data as unknown as League).created_by;
    if (createdBy) {
      const { data: prof } = await supabase
        .from("profiles_public" as never)
        .select("display_name, full_name, first_name, last_name")
        .eq("id", createdBy)
        .maybeSingle();
      if (prof) {
        const p = prof as { display_name?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null };
        const name = p.display_name
          || p.full_name
          || [p.first_name, p.last_name].filter(Boolean).join(" ")
          || null;
        setManagerName(name);
      } else {
        setManagerName(null);
      }
    }
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
    for (const key of ['my-leagues', 'my-upcoming-league-matches', 'player-league-detail', 'league-seasons', 'league-actions', 'league-sub-requests']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
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

  if (loadError) {
    return shell(<div role="alert" className="mx-auto max-w-md p-6 text-center space-y-3">
      <p className="font-semibold">Couldn't load league management</p>
      <p className="text-sm text-muted-foreground">{loadError}</p>
      <button className="rounded-xl border px-4 py-2" onClick={() => void refresh()}>Try again</button>
    </div>);
  }

  if (accessDenied || !league) {
    return shell(
      <div className="container mx-auto px-4 py-10 max-w-md text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Trophy className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">You don't have access</p>
        <p className="text-xs text-muted-foreground">
          Only the owner, active assistant managers, and platform administrators can manage this league.
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

  const activeTabDef = MANAGE_TABS.find((t) => t.key === activeTab);
  // Teams are a team-format concept only. Individual formats (ladder,
  // singles, flex) have no teams, so don't surface a "Teams" stat for them.
  const isTeamFormat =
    league.league_type === "doubles" || league.league_type === "team";

  return shell(
    <LeagueScope>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 max-w-[1440px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="h-11 rounded-xl" onClick={() => navigate(backHref)}>
            <ArrowLeft className="h-4 w-4" /> All leagues
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate(`/player/leagues/${league.id}${searchParams.get('season') ? `?season=${encodeURIComponent(searchParams.get('season')!)}` : ''}`)}>
            <ExternalLink className="h-4 w-4" /> Player view
          </Button>
        </div>
        {activeTab === 'actions' ? <section className="lg-hero-gradient rounded-2xl p-5 sm:p-6">
          <p className="text-sm text-[color:var(--lg-hero-text-dim)]">League management</p>
          <h1 className="mt-1 break-words text-2xl sm:text-3xl font-semibold text-[color:var(--lg-hero-text)]">{league.name}</h1>
          <p className="mt-2 text-sm text-[color:var(--lg-hero-text-dim)]">Your requests, roster decisions and results in one place.</p>
        </section> : <LeagueHero
          league={league}
          managerName={managerName}
          eyebrow={
            <>
              <span className="text-xs font-medium text-[color:var(--lg-hero-text-dim)]">
                {league.visibility.replace("_", " ")}
              </span>
              {league.guests_allowed && (
                <span className="text-xs font-medium text-[color:var(--lg-hero-text-dim)]">
                  · Guests allowed
                </span>
              )}
            </>
          }
          kpis={counts ? [
            { icon: CalendarDays, label: "Seasons", value: counts.seasons },
            { icon: Users, label: "Roster", value: counts.members },
            ...(isTeamFormat
              ? [{ icon: UsersRound, label: "Teams", value: counts.teams }]
              : []),
            { icon: CalendarClock, label: "Sessions", value: counts.sessions },
          ] : undefined}
        />}

        {activeTab !== 'actions' && <button type="button" onClick={() => setActiveTab('actions')}
          className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left text-sm">
          <span className="font-semibold">{actions.error ? 'Pending actions could not be checked' : actions.isPending ? 'Checking pending actions…' : `${actions.data?.total ?? 0} items need attention`}</span>
          <span>Open Actions →</span>
        </button>}

        {/* First-run order-of-operations for ladder managers (dismissible). */}
        {activeTab !== 'actions' && league.league_type === "ladder" && counts && (
          <LeagueSetupChecklist
            leagueId={league.id}
            seasons={counts.seasons}
            members={counts.members}
            onGoToTab={setActiveTab}
          />
        )}

        {/* Rail + workspace */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <LeagueManageNav active={activeTab} onChange={setActiveTab} tabs={visibleTabs} />

          <div className="flex-1 min-w-0 space-y-3">
            {activeTabDef && (
              <div className="hidden lg:flex flex-wrap items-baseline gap-2 pb-1">
                <h2 className="text-base font-semibold text-[color:var(--lg-text)]">
                  {activeTabDef.label}
                </h2>
                <span className="text-sm text-[color:var(--lg-text-dim)]">
                  · {activeTabDef.hint}
                </span>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false} custom={tabDir}>
              <motion.div
                key={activeTab}
                custom={tabDir}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                // mode="wait" runs exit then enter serially, so each half is
                // kept short to keep the whole switch within the ~200-320ms
                // perceived-content budget.
                transition={{ duration: DUR.hover, ease: EASE_OUT }}
              >
                {activeTab === "actions" && <ActionsTab query={actions} onMutated={onDataMutated} onNavigate={(tab, seasonId) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', tab);
                  if (seasonId) next.set('season', seasonId);
                  if (tab === 'matches') next.set('review', 'true'); else next.delete('review');
                  setSearchParams(next);
                }} />}
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
                  <TeamsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} onNavigate={setActiveTab} />
                )}
                {activeTab === "subs" && (
                  <SubstitutesTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "ladder" && (
                  <LadderTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} onNavigate={setActiveTab} />
                )}
                {activeTab === "sessions" && (
                  <SessionsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} />
                )}
                {activeTab === "matches" && (
                  <MatchesTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} onNavigate={setActiveTab} />
                )}
                {activeTab === "standings" && (
                  <StandingsTab league={league} dataVersion={dataVersion} onMutated={onDataMutated} onNavigate={setActiveTab} />
                )}
                {activeTab === "audit" && (
                  <AuditLogTab league={league} dataVersion={dataVersion} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </LeagueScope>,
    league.name
  );
}

