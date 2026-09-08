import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RRLeftSidebar, RRRightSidebar } from "@/components/roundrobin/RoundRobinManageSidebars";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Trophy, AlertCircle, Settings, Trash2, Ban, CheckCircle, Edit, Edit3, Bell, Monitor, ExternalLink, Share2, Users, UserMinus, Calendar, MapPin, Zap, RefreshCw, Medal, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { TeamNamesStack } from "@/components/round-robin/TeamNamesStack";

import { toast } from "sonner";

import { format, parseISO } from "date-fns";
import { EditEventDialog } from "@/components/round-robin/EditEventDialog";
import { EditModeBanner } from "@/components/round-robin/EditModeBanner";
import { RankBadge } from "@/components/round-robin/RankBadge";
import { InviteCodeCard } from "@/components/round-robin/InviteCodeCard";
import { GuestInviteDialog } from "@/components/round-robin/GuestInviteDialog";
import { Send } from "lucide-react";
import { WhatsNextBanner } from "@/components/round-robin/WhatsNextBanner";
import { RoundRobinTopBar } from "@/components/round-robin/RoundRobinTopBar";
import { RoundRobinHostHero } from "@/components/round-robin/RoundRobinHostHero";
import { HostControlsMenu } from "@/components/round-robin/HostControlsMenu";
import { PlayerManagementDialog } from "@/components/round-robin/PlayerManagementDialog";
import { CourtsRoundsDialog } from "@/components/round-robin/CourtsRoundsDialog";
import { ScheduleImpactPreview } from "@/components/round-robin/ScheduleImpactPreview";
import { ScheduleEditorDialog } from "@/components/round-robin/ScheduleEditorDialog";
import { ScoreManagementDialog } from "@/components/round-robin/ScoreManagementDialog";
import { AuditHistoryDialog } from "@/components/round-robin/AuditHistoryDialog";
import { EditNotifications } from "@/components/round-robin/EditNotifications";
import { RegistrationManagement } from "@/components/round-robin/RegistrationManagement";
import { PlayerRoundRobinView } from "@/components/round-robin/PlayerRoundRobinView";
import { PageHeader } from "@/components/PageHeader";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  callRrManageParticipant,
  friendlyRpcError,
  type RRManageParticipantError,
} from "@/lib/roundRobin/manageParticipantRpc";
import {
  manageParticipantWithEscalation,
  friendlyParticipantError,
  isInfrastructureError,
} from "@/lib/roundRobin/participantOrchestration";
import {
  findParticipantLiveMatch,
  type LiveMatchRow,
  type ActiveMatchResolutionKind,
} from "@/lib/roundRobin/activeMatch";
import { ActiveMatchResolutionDialog } from "@/components/round-robin/ActiveMatchResolutionDialog";
import { resolveRRParticipant } from "@/lib/roundRobin/resolveParticipant";
import { computeStandings, guestSeatLabel } from "@/lib/roundRobin/standings";
import { suggestRounds } from "@/lib/roundRobinFairness";
import { isPlatformAdmin } from "@/lib/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePlayerInitials } from "@/lib/matchDisplay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startPulseActivity } from "@/components/ui/pulse-activity";
import {
  planScheduleAdjustment,
  type ScheduleAdjustmentPlan,
  type ScheduleSubstitution,
} from "@/lib/roundRobin/scheduleAdjustment";
import {
  seatsOf,
  type CoreMatch,
  type EventFormat,
  type SeatId,
} from "@/lib/roundRobin/scheduleCore";
import { participantGenderEligibility } from "@/lib/roundRobin/participantGender";
import { fetchCanonicalRoundRobinSchedule } from "@/lib/roundRobin/fetchScheduleRows";


// Score validation schema
const scoreSchema = z.object({
  team1_score: z.number().min(0).max(99),
  team2_score: z.number().min(0).max(99),
}).refine(
  (data) => data.team1_score !== data.team2_score,
  { message: "Scores cannot be tied" }
);

interface Event {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  notes: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  games_per_player?: number;
  current_round: number | null;
  status: "draft" | "live" | "completed" | "voided";
  rating_eligible: boolean;
  rating_type: "ladder" | "league" | "playoffs" | "casual";
  format?: EventFormat;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  voided: boolean;
  registration_deadline?: string | null;
  registration_mode?: string | null;
  max_players?: number | null;
  /** Auto-generated invite code for invite-only events (XYZ-ABCD format).
   *  Surfaced to the host so they can share it with players. */
  invite_code?: string | null;
  group_id?: string | null;
  /** When true, this event accepts guest_players and is excluded from PULSE
   *  Ratings. Surfaced in the hero so the host always sees why. */
  allow_guests?: boolean;
  /** Incremented by every transactional schedule mutation. */
  schedule_version: number;

}

interface Player {
  id: string;
  event_id: string;
  player_id: string | null;
  guest_player_id: string | null;
  guest_name: string | null;
  joined_at: string;
  active: boolean;
  status?: string;
  effective_round?: number | null;
  schedule_game_credit?: number | null;
  schedule_first_eligible_round?: number | null;
  profiles: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url?: string | null;
    gender?: string | null;
  } | null;
  guest_players?: {
    id: string;
    display_name: string;
    linked_user_id: string | null;
    email?: string | null;
    gender?: string | null;
    /** Linked profile gender takes precedence over the saved-guest fallback. */
    effective_gender?: string | null;
  } | null;
}

interface RosterAdditionInput {
  playerId: string | null;
  guestPlayerId?: string | null;
  guestName?: string;
}


interface ScheduleMatch {
  id: string;
  event_id: string;
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  a1_guest_id: string | null;
  a2_guest_id: string | null;
  b1_guest_id: string | null;
  b2_guest_id: string | null;
  a1_profile?: { display_name?: string | null; full_name?: string | null; avatar_url?: string | null } | null;
  a2_profile?: { display_name?: string | null; full_name?: string | null; avatar_url?: string | null } | null;
  b1_profile?: { display_name?: string | null; full_name?: string | null; avatar_url?: string | null } | null;
  b2_profile?: { display_name?: string | null; full_name?: string | null; avatar_url?: string | null } | null;
  a1_guest?: { display_name?: string | null; linked_user_id?: string | null } | null;
  a2_guest?: { display_name?: string | null; linked_user_id?: string | null } | null;
  b1_guest?: { display_name?: string | null; linked_user_id?: string | null } | null;
  b2_guest?: { display_name?: string | null; linked_user_id?: string | null } | null;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  match_id: string | null;
  locked_at?: string | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  abandoned?: boolean | null;
}

interface StandingsRow {
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  isRemoved?: boolean;
}

interface MatchScore {
  [matchId: string]: {
    team1_score: number;
    team2_score: number;
  };
}

/**
 * Small side-by-side avatar pair for a team on the schedule card.
 * Registered players show their uploaded avatar; anyone without one
 * (guests, no-photo players) falls back to initials. Kept compact
 * (h-6 w-6) so it doesn't crowd the dense court cards.
 */
function SeatAvatars({
  seats,
}: {
  seats: { name: string; avatarUrl: string | null }[];
}) {
  return (
    <div className="flex -space-x-1.5 shrink-0" aria-hidden>
      {seats.map((s, i) => (
        <Avatar key={i} className="h-6 w-6 ring-2 ring-card">
          {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt="" />}
          <AvatarFallback className="text-[9px] font-semibold bg-muted">
            {resolvePlayerInitials(s.name)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

export default function RoundRobinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Back-nav lands on the player's own round-robin history page.
  const backHref = "/player/round-robins";
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const ratingRecalcCheckedRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // Controlled tab state — lets the custom strip animate a sliding
  // underline indicator (the uncontrolled shadcn TabsList can't).
  const [activeTab, setActiveTab] = useState<"schedule" | "players" | "standings">("schedule");
  const [scores, setScores] = useState<MatchScore>({});
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'void' | 'hard'>('void');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [playerManagementOpen, setPlayerManagementOpen] = useState(false);
  const [courtsRoundsOpen, setCourtsRoundsOpen] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [scoreManagementOpen, setScoreManagementOpen] = useState(false);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const [repairingSchedule, setRepairingSchedule] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [inviteGuest, setInviteGuest] = useState<{ id: string; name: string; email: string | null } | null>(null);
  // When an organizer pulls a player who is currently ON COURT in the live
  // round, we collect an explicit decision about that in-progress game before
  // touching the roster (the RPC requires it). `run` is the continuation that
  // actually applies the change once the host picks a resolution.
  const [activeMatchPrompt, setActiveMatchPrompt] = useState<{
    participantName: string;
    courtNo: number;
    isScored: boolean;
    team1Score: number | null;
    team2Score: number | null;
    run: (kind: ActiveMatchResolutionKind) => Promise<void>;
  } | null>(null);
  const [resolvingActiveMatch, setResolvingActiveMatch] = useState(false);

  useEffect(() => {
    fetchEventDetails();
    fetchAuditHistory();
    
    // Event-scoped channel name — a shared name collides if two detail
    // views are ever mounted (or remount mid-teardown on fast nav).
    const channel = supabase
      .channel(`round-robin-changes-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_events',
          filter: `id=eq.${id}`
        },
        () => scheduleRealtimeRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_schedule',
          filter: `event_id=eq.${id}`
        },
        () => scheduleRealtimeRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_players',
          filter: `event_id=eq.${id}`
        },
        () => scheduleRealtimeRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [id]);

  // A transactional rebuild inserts many schedule rows, and Supabase emits a
  // realtime event for each one. Coalesce that burst into one authoritative
  // refresh so the host view does not flicker or launch dozens of duplicate
  // roster/profile queries.
  const scheduleRealtimeRefresh = () => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void fetchEventDetails();
    }, 180);
  };

  const fetchAuditHistory = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("round_robin_audit")
      .select("id, change_type, editor_id, changes, created_at, reason")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching audit history:", error);
      return;
    }

    // Do not depend on a cross-table embed here. The external Supabase
    // project cannot infer every relationship through profiles_public, which
    // made the whole audit request fail after cutover.
    const editorIds = [...new Set((data ?? []).map((entry) => entry.editor_id).filter(Boolean))] as string[];
    const { data: editorProfiles, error: profileError } = editorIds.length > 0
      ? await supabase
          .from("profiles_public")
          .select("id, display_name, full_name")
          .in("id", editorIds)
      : { data: [], error: null };

    if (profileError) {
      console.error("Error fetching audit editors:", profileError);
    }
    const editorsById = new Map(
      (editorProfiles ?? []).map((profile) => [profile.id, profile.display_name || profile.full_name]),
    );

    const formattedEntries = (data ?? []).map((entry) => ({
      ...entry,
      editor_name: editorsById.get(entry.editor_id) || "Unknown",
    }));

    setAuditEntries(formattedEntries);
  };

  const fetchEventDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Keep the base reads independent and portable. Cross-table embeds
      // through profiles_public worked in Lovable's PostgREST schema cache but
      // fail on the external Supabase project, zeroing the roster and schedule.
      const [adminFlag, eventResult, playersResult, scheduleData] = await Promise.all([
        isPlatformAdmin(user.id),
        supabase
          .from("round_robin_events")
          .select("*")
          .eq("id", id)
          .single(),
        supabase
          .from("round_robin_players")
          .select("*")
          .eq("event_id", id),
        fetchCanonicalRoundRobinSchedule(supabase, id!),
      ]);

      setIsAdmin(adminFlag);

      const { data: eventData, error: eventError } = eventResult;
      if (eventError) throw eventError;
      setEvent(eventData);
      setIsOrganizer(eventData.organizer_id === user.id);

      const { data: playersData, error: playersError } = playersResult;
      if (playersError) throw playersError;

      const rawPlayers = (playersData ?? []) as unknown as Player[];
      const rawSchedule = (scheduleData ?? []) as unknown as ScheduleMatch[];
      const profileIds = new Set<string>();
      const guestIds = new Set<string>();

      rawPlayers.forEach((player) => {
        if (player.player_id) profileIds.add(player.player_id);
        if (player.guest_player_id) guestIds.add(player.guest_player_id);
      });
      rawSchedule.forEach((match) => {
        [match.a1_player_id, match.a2_player_id, match.b1_player_id, match.b2_player_id]
          .forEach((playerId) => { if (playerId) profileIds.add(playerId); });
        [match.a1_guest_id, match.a2_guest_id, match.b1_guest_id, match.b2_guest_id]
          .forEach((guestId) => { if (guestId) guestIds.add(guestId); });
      });

      const [profilesResult, guestsResult] = await Promise.all([
        profileIds.size > 0
          ? supabase
              .from("profiles_public")
              .select("id, full_name, display_name, avatar_url, gender")
              .in("id", [...profileIds])
          : Promise.resolve({ data: [], error: null }),
        guestIds.size > 0
          ? supabase
              .from("guest_players")
              .select("id, display_name, linked_user_id, email, gender")
              .in("id", [...guestIds])
          : Promise.resolve({ data: [], error: null }),
      ]);
      // Roster identities decorate the already-loaded event data. If a
      // migrated view or guest policy is unavailable, keep the schedule and
      // roster usable with fallback labels instead of failing the whole page.
      if (profilesResult.error) console.error("Error hydrating round-robin profiles:", profilesResult.error);
      if (guestsResult.error) console.error("Error hydrating round-robin guests:", guestsResult.error);

      const profilesById = new Map(
        (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
      );
      const missingLinkedProfileIds = [...new Set(
        (guestsResult.data ?? []).flatMap((guest) =>
          guest.linked_user_id && !profilesById.has(guest.linked_user_id)
            ? [guest.linked_user_id]
            : [],
        ),
      )];
      if (missingLinkedProfileIds.length > 0) {
        const { data: linkedProfiles, error: linkedProfilesError } = await supabase
          .from("profiles_public")
          .select("id, full_name, display_name, avatar_url, gender")
          .in("id", missingLinkedProfileIds);
        if (linkedProfilesError) {
          console.error("Error hydrating linked guest profiles:", linkedProfilesError);
        } else {
          (linkedProfiles ?? []).forEach((profile) => profilesById.set(profile.id, profile));
        }
      }
      const guestsById = new Map(
        (guestsResult.data ?? []).map((guest) => [
          guest.id,
          {
            ...guest,
            effective_gender:
              (guest.linked_user_id
                ? profilesById.get(guest.linked_user_id)?.gender
                : null) ?? guest.gender,
          },
        ]),
      );
      const hydratedPlayers: Player[] = rawPlayers.map((player) => ({
        ...player,
        profiles: player.player_id
          ? (profilesById.get(player.player_id) as Player["profiles"] | undefined) ?? null
          : null,
        guest_players: player.guest_player_id
          ? (guestsById.get(player.guest_player_id) as Player["guest_players"] | undefined) ?? null
          : null,
      }));
      const hydratedSchedule: ScheduleMatch[] = rawSchedule.map((match) => ({
        ...match,
        a1_profile: match.a1_player_id ? profilesById.get(match.a1_player_id) ?? null : null,
        a2_profile: match.a2_player_id ? profilesById.get(match.a2_player_id) ?? null : null,
        b1_profile: match.b1_player_id ? profilesById.get(match.b1_player_id) ?? null : null,
        b2_profile: match.b2_player_id ? profilesById.get(match.b2_player_id) ?? null : null,
        a1_guest: match.a1_guest_id ? guestsById.get(match.a1_guest_id) ?? null : null,
        a2_guest: match.a2_guest_id ? guestsById.get(match.a2_guest_id) ?? null : null,
        b1_guest: match.b1_guest_id ? guestsById.get(match.b1_guest_id) ?? null : null,
        b2_guest: match.b2_guest_id ? guestsById.get(match.b2_guest_id) ?? null : null,
      }));

      setPlayers(hydratedPlayers);
      setSchedule(hydratedSchedule);
      setIsParticipant(hydratedPlayers.some((player) => player.player_id === user.id && player.active));
      calculateStandings(hydratedSchedule, hydratedPlayers);

      setLoading(false);
    } catch (error: unknown) {
      toast.error("Failed to load event details. Please try again.");
      console.error(error);
      setLoading(false);
    }
  };

  // Auto-trigger rating recalculation for completed events with unprocessed matches
  useEffect(() => {
    const checkAndRecalculateRatings = async () => {
      if (!event || event.status !== 'completed' || !event.rating_eligible) return;
      // Once per mount — this effect re-fires on every schedule refetch,
      // and each firing cost a match_participants query (plus a possible
      // full recalculate_all_ratings). One check per page view is enough.
      if (ratingRecalcCheckedRef.current) return;
      ratingRecalcCheckedRef.current = true;
      
      // Check if there are any matches with match_id but no rating_after
      const matchesWithIds = schedule.filter(m => m.match_id && !m.is_bye);
      if (matchesWithIds.length === 0) return;
      
      // Check if ratings have been calculated for these matches
      const { data: participants } = await supabase
        .from('match_participants')
        .select('rating_after')
        .in('match_id', matchesWithIds.map(m => m.match_id))
        .limit(1);
      
      // If we have matches but no ratings calculated, trigger recalculation
      if (participants && participants.length > 0 && participants[0].rating_after === null) {
        console.log('Triggering rating recalculation for completed round robin...');
        const { error } = await supabase.rpc('recalculate_all_ratings');
        if (error) {
          console.error('Failed to recalculate ratings:', error);
        } else {
          toast.success('Ratings calculated for round robin matches!');
        }
      }
    };
    
    checkAndRecalculateRatings();
  }, [event, schedule]);

  const handleGenerateSchedule = async () => {
    if (!event) return;

    const activePlayers = players.filter((player) => player.active !== false);
    if (activePlayers.length < 4) {
      toast.error("At least 4 players are required");
      return;
    }

    // Guests are now supported: just verify every seat has either a player or a guest.
    const unfilled = activePlayers.filter(
      (p) => !p.player_id && !(p as { guest_player_id?: string }).guest_player_id,
    );
    if (unfilled.length > 0) {
      toast.error("Every roster slot must be either a registered player or a guest.");
      return;
    }

    // Use the in-app review surface below instead of a browser-native confirm.
    // The preview and the eventual Edge call share the same planner inputs.
    setRegenConfirmOpen(true);
  };

  const handleStartEvent = async () => {
    try {
      const { error } = await supabase
        .from("round_robin_events")
        .update({ status: "live", current_round: 1 })
        .eq("id", id);

      if (error) throw error;
      toast.success("Event started!");
      fetchEventDetails();
    } catch (error: unknown) {
      toast.error("Failed to start event");
      console.error(error);
    }
  };

  const handleCloseRound = async (roundNo: number) => {
    if (!event) return;
    
    const roundMatches = schedule.filter(s => s.round_no === roundNo && !s.is_bye);
    const allScored = roundMatches.every(m => m.team1_score !== null && m.team2_score !== null);
    
    if (!allScored) {
      toast.error("All matches in this round must be scored before closing");
      return;
    }

    try {
      const nextRound = roundNo + 1;
      if (nextRound <= event.num_rounds) {
        await supabase
          .from("round_robin_events")
          .update({ current_round: nextRound })
          .eq("id", id);
        toast.success(`Round ${roundNo} closed! Round ${nextRound} is now active.`);
      } else {
        toast.info("This is the final round. Complete the event to submit to match history.");
      }
      fetchEventDetails();
    } catch (error: unknown) {
      toast.error("Failed to close round");
      console.error(error);
    }
  };

  const getPlayerName = (playerId: string | null, matchData?: any) => {
    if (!playerId) return "—";

    // Prefer joined data on the match row (handles both profiles and guests).
    if (matchData) {
      const seat =
        playerId === matchData.a1_player_id || playerId === matchData.a1_guest_id ? 'a1' :
        playerId === matchData.a2_player_id || playerId === matchData.a2_guest_id ? 'a2' :
        playerId === matchData.b1_player_id || playerId === matchData.b1_guest_id ? 'b1' :
        playerId === matchData.b2_player_id || playerId === matchData.b2_guest_id ? 'b2' : null;

      if (seat) {
        const profile = matchData[`${seat}_profile`];
        const guest = matchData[`${seat}_guest`];
        if (profile?.display_name || profile?.full_name) {
          return profile.display_name || profile.full_name;
        }
        if (guest?.display_name) return (guest as { linked_user_id?: string | null }).linked_user_id ? guest.display_name : `${guest.display_name} (G)`;
      }
    }

    // Fallback to players array — id may be either a registered player_id or a guest_player_id.
    const player = players.find(
      (p) => p.player_id === playerId || (p as any).guest_player_id === playerId,
    );
    if (player?.profiles?.display_name || player?.profiles?.full_name) {
      return player.profiles.display_name || player.profiles.full_name;
    }
    if (player?.guest_players?.display_name) {
      return player.guest_players.linked_user_id ? player.guest_players.display_name : `${player.guest_players.display_name} (G)`;
    }
    if (player?.guest_name) {
      return `${player.guest_name} (G)`;
    }
    return "Unknown Player";
  };

  // Resolve a seat's display name regardless of whether it's filled by a
  // registered player or a guest. Use this in render paths where we'd
  // previously have hard-coded `match.<seat>_player_id`.
  const getSeatName = (match: any, seat: 'a1' | 'a2' | 'b1' | 'b2') => {
    const id = match?.[`${seat}_player_id`] ?? match?.[`${seat}_guest_id`] ?? null;
    return getPlayerName(id, match);
  };

  // Resolve a seat's avatar URL. Registered players carry an avatar via
  // the joined profile; guests have none (initials fallback handles it).
  // Falls back to the players array by player_id when the schedule join
  // didn't include the profile (edge cases / stale rows).
  const getSeatAvatar = (match: any, seat: 'a1' | 'a2' | 'b1' | 'b2'): string | null => {
    const joined = match?.[`${seat}_profile`]?.avatar_url;
    if (joined) return joined;
    const pid = match?.[`${seat}_player_id`] ?? null;
    if (pid) {
      const p = players.find((pl) => pl.player_id === pid);
      const url = (p?.profiles as { avatar_url?: string | null } | null)?.avatar_url;
      if (url) return url;
    }
    return null;
  };

  const getRoundMatches = (roundNo: number) => {
    return schedule.filter((s) => s.round_no === roundNo);
  };

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', value: string) => {
    const numValue = parseInt(value) || 0;
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'team1' ? 'team1_score' : 'team2_score']: numValue,
      }
    }));
  };

  const calculateStandings = (scheduleData: ScheduleMatch[], playersData: Player[]) => {
    // Canonical standings math lives in src/lib/roundRobin/standings.ts so the
    // organizer page, kiosk, and player view can never diverge on tie-breaks
    // or on how removed/withdrawn players are ranked.
    const participants = playersData
      .map((p) => {
        const key = p.player_id || (p as any).guest_player_id;
        if (!key) return null;
        const guestRow = (p as any).guest_players as
          | { display_name?: string | null; linked_user_id?: string | null }
          | undefined;
        const name = p.profiles
          ? p.profiles.display_name || p.profiles.full_name
          : guestSeatLabel(guestRow, (p as any).guest_name);
        return { key, name, active: !!p.active };
      })
      .filter(Boolean) as { key: string; name: string; active: boolean }[];

    setStandings(
      computeStandings(scheduleData, participants).map((r) => ({
        player_id: r.key,
        player_name: r.name,
        wins: r.wins,
        losses: r.losses,
        points_for: r.pointsFor,
        points_against: r.pointsAgainst,
        point_diff: r.pointDiff,
        isRemoved: r.isRemoved,
      })),
    );
  };


  const handleSaveScore = async (match: ScheduleMatch) => {
    if (!event || !userId) return;

    const score = scores[match.id];
    if (!score) {
      toast.error("Enter scores for both teams");
      return;
    }

    const validation = scoreSchema.safeParse(score);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingScore(match.id);
    try {
      // Phase-2 immediate sync — submit_rr_match_score atomically updates
      // round_robin_schedule AND upserts the corresponding matches +
      // match_participants rows in one server-side transaction. The match
      // appears in the player's history right away instead of waiting for
      // event completion. The match-insert trigger fires the rating
      // recalc automatically (when count_for_rating = true).
      const { error } = await supabase.rpc("submit_rr_match_score", {
        p_schedule_id: match.id,
        p_team1_score: score.team1_score,
        p_team2_score: score.team2_score,
      });

      if (error) throw error;

      toast.success("Score saved");
      fetchEventDetails();

      setScores(prev => {
        const newScores = { ...prev };
        delete newScores[match.id];
        return newScores;
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save score"));
      console.error(error);
    } finally {
      setSavingScore(null);
    }
  };

  const handleCompleteEvent = async () => {
    if (!event) return;
    
    // Check if all matches have scores, show confirmation for partial submission
    const unscoredMatches = schedule.filter(m => !m.is_bye && (m.team1_score === null || m.team2_score === null));
    const scoredMatches = schedule.filter(m => !m.is_bye && m.team1_score !== null && m.team2_score !== null);
    
    if (unscoredMatches.length > 0) {
      const totalMatches = schedule.filter(m => !m.is_bye).length;
      const confirmMessage = `You have ${unscoredMatches.length} unscored match(es) out of ${totalMatches} total.\n\nOnly the ${scoredMatches.length} completed match(es) will be saved to match history.\n\nContinue?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    try {
      // Phase-2 immediate-sync model: every score entered via
      // handleSaveScore / handleEditMatchScore was already pushed into
      // matches + match_participants by submit_rr_match_score. So
      // completion has only two jobs left:
      //   1. Backfill any scored schedule rows that DON'T yet have a
      //      linked match_id (e.g. events scored before this migration
      //      shipped). Idempotent via the same RPC.
      //   2. Flip the event's status to 'completed'.
      const needsBackfill = scoredMatches.filter(m => !m.match_id);
      const errors: string[] = [];
      let backfilled = 0;

      for (const m of needsBackfill) {
        const { error } = await supabase.rpc("submit_rr_match_score", {
          p_schedule_id: m.id,
          p_team1_score: m.team1_score!,
          p_team2_score: m.team2_score!,
        });
        if (error) {
          errors.push(`Round ${m.round_no} Court ${m.court_no}: ${getErrorMessage(error)}`);
        } else {
          backfilled += 1;
        }
      }

      // QA-flagged: previously this loop silently swallowed per-match
      // failures and then marked the event complete anyway, leaving
      // scored matches orphaned from match history. Bail before status
      // flip if anything in the backfill failed so the host knows their
      // event isn't fully synced.
      if (errors.length > 0) {
        toast.error(`Cannot complete — ${errors.length} match(es) failed to sync`, {
          description: errors.slice(0, 3).join("; "),
        });
        console.error("Match sync errors during completion:", errors);
        return;
      }

      const { error: statusError } = await supabase
        .from("round_robin_events")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_round: null,
        })
        .eq("id", id);

      if (statusError) throw statusError;

      // Audit the completion itself.
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId!,
        change_type: "event_complete",
        changes: {
          synced_total: scoredMatches.length,
          backfilled,
          unscored: unscoredMatches.length,
        },
        reason: "Event marked complete",
      });

      toast.success(
        backfilled > 0
          ? `Event completed · ${scoredMatches.length} matches in history (${backfilled} backfilled)`
          : `Event completed · ${scoredMatches.length} matches in history`,
      );

      fetchEventDetails();
    } catch (error: unknown) {
      toast.error(`Failed to complete event: ${getErrorMessage(error)}`);
      console.error(error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;

    try {
      if (deleteMode === 'void') {
        const { error } = await supabase.rpc('void_round_robin_event', {
          p_event_id: event.id,
          p_reason: 'Event voided by organizer'
        });
        if (error) throw error;
        toast.success("Event voided. Results no longer count toward ratings.");
        // After voiding the host should return to their history — the
        // event itself is now read-only and there's nothing more to do
        // on the detail page in the moment.
        setDeleteDialogOpen(false);
        navigate(backHref);
        return;
      } else {
        const { error } = await supabase.rpc('delete_round_robin_event', {
          p_event_id: event.id
        });
        if (error) throw error;
        toast.success("Event deleted.");
        setDeleteDialogOpen(false);
        navigate(backHref);
        return;
      }
    } catch (error: unknown) {
      // RPC errors surface here. The void/delete RPCs raise sharp
      // messages on permission failure and on the "scored event can't
      // be hard-deleted by non-admin" guard — show them verbatim.
      toast.error(getErrorMessage(error, "Failed to update event"));
      console.error(error);
    }
  };

  const handleSaveEventSettings = async (updates: Partial<Event>) => {
    if (!event || !userId) return;

    try {
      // Create audit entry
      const before = {
        name: event.name,
        notes: event.notes,
        rating_eligible: event.rating_eligible,
        rating_type: event.rating_type,
      };

      const after = { ...before, ...updates };

      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "event_settings",
        changes: { before, after },
        reason: "Event settings updated",
      });

      // Update event
      const { error } = await supabase
        .from("round_robin_events")
        .update(updates)
        .eq("id", event.id);

      if (error) throw error;

      toast.success("Event settings updated");
      await fetchEventDetails();
      await fetchAuditHistory();
      setHasUnsavedChanges(false);
    } catch (error: unknown) {
      toast.error("Failed to update event settings");
      console.error(error);
    }
  };

  const handleToggleEditMode = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    setIsEditMode(!isEditMode);
  };

  const regenerateScheduleFromRound = async (
    fromRound: number,
    overrides?: {
      numCourts?: number;
      gamesPerPlayer?: number;
      reason?: string;
      /** null lets the server snapshot the version after another atomic RPC. */
      expectedVersion?: number | null;
      /** Explicit identity handoff used to carry only the outgoing player's
       * protected-play allocation gap into the replacement's future rotation. */
      substitutions?: ScheduleSubstitution[];
    },
  ): Promise<{
    previousRounds: number;
    targetRounds: number;
    roundsChanged: boolean;
    impact?: { summary?: string };
    fairness?: { score?: number; gameRange?: { min: number; max: number; spread: number } };
    warnings?: Array<{ code: string; severity: string; message: string }>;
  } | undefined> => {
    if (!event) return;

    const gamesPerPlayer = overrides?.gamesPerPlayer ?? (event.games_per_player || 3);
    const numCourts = overrides?.numCourts ?? event.num_courts;
    const previousRounds = event.num_rounds;

    // The edge function snapshots the authoritative active roster and
    // canonical schedule, plans the remaining player-game obligations, then
    // commits settings + rows + version + audit in one database transaction.
    // It also advances this boundary past the live/current or scored rounds.
    const { data, error: generateError } = await supabase.functions.invoke("generate-round-robin-schedule", {
      body: {
        request_id: crypto.randomUUID(),
        event_id: event.id,
        num_courts: numCourts,
        num_rounds: event.num_rounds,
        games_per_player: gamesPerPlayer,
        regenerate_from_round: Math.max(1, fromRound),
        expected_version: overrides?.expectedVersion === null
          ? undefined
          : (overrides?.expectedVersion ?? event.schedule_version ?? 0),
        reason: overrides?.reason,
        substitutions: overrides?.substitutions,
      },
    });
    if (generateError) throw generateError;

    const result = data as {
      num_rounds?: number;
      impact?: { summary?: string };
      fairness?: { score?: number; gameRange?: { min: number; max: number; spread: number } };
      warnings?: Array<{ code: string; severity: string; message: string }>;
    } | null;
    const targetRounds = result?.num_rounds ?? previousRounds;

    await fetchEventDetails();
    return {
      previousRounds,
      targetRounds,
      roundsChanged: targetRounds !== previousRounds,
      impact: result?.impact,
      fairness: result?.fairness,
      warnings: result?.warnings,
    };
  };

  const validateRosterInputsForFormat = async (
    inputs: readonly RosterAdditionInput[],
  ) => {
    for (const input of inputs) {
      if (!!input.playerId === !!input.guestPlayerId) {
        throw new Error("Each roster addition must identify exactly one player or guest.");
      }
    }

    const format = (event?.format || "open") as EventFormat;
    if (format === "open" || inputs.length === 0) return;

    const profileIds = [...new Set(
      inputs.flatMap((input) => input.playerId ? [input.playerId] : []),
    )];
    const guestIds = [...new Set(
      inputs.flatMap((input) => input.guestPlayerId ? [input.guestPlayerId] : []),
    )];
    const [profileResult, guestResult] = await Promise.all([
      profileIds.length > 0
        ? supabase
            .from("profiles_public")
            .select("id, gender")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      guestIds.length > 0
        ? supabase
            .from("guest_players")
            .select("id, gender, linked_user_id")
            .in("id", guestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (guestResult.error) throw guestResult.error;

    const linkedProfileIds = [...new Set(
      (guestResult.data ?? []).flatMap((guest) =>
        guest.linked_user_id ? [guest.linked_user_id] : [],
      ),
    )];
    const linkedProfileResult = linkedProfileIds.length > 0
      ? await supabase
          .from("profiles_public")
          .select("id, gender")
          .in("id", linkedProfileIds)
      : { data: [], error: null };
    if (linkedProfileResult.error) throw linkedProfileResult.error;

    const genders = new Map<string, string | null>();
    const linkedGenders = new Map<string, string | null>();
    (profileResult.data ?? []).forEach((profile) => {
      if (profile.id) genders.set(`p:${profile.id}`, profile.gender);
    });
    (linkedProfileResult.data ?? []).forEach((profile) => {
      if (profile.id) linkedGenders.set(profile.id, profile.gender);
    });
    (guestResult.data ?? []).forEach((guest) => {
      genders.set(
        `g:${guest.id}`,
        (guest.linked_user_id
          ? linkedGenders.get(guest.linked_user_id)
          : null) ?? guest.gender,
      );
    });

    for (const input of inputs) {
      const identity = input.playerId
        ? `p:${input.playerId}`
        : `g:${input.guestPlayerId}`;
      const eligibility = participantGenderEligibility(format, genders.get(identity));
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason || "That player is not eligible for this format.");
      }
    }
  };

  const handleAddPlayers = async (
    requestedAdditions: RosterAdditionInput[],
  ): Promise<number> => {
    if (!event || !userId || requestedAdditions.length === 0) return 0;
    if (event.voided || event.status === "completed" || event.status === "voided") {
      throw new Error("This event is closed. Its roster and results are locked.");
    }

    // De-duplicate by canonical participant identity before touching the DB.
    // This also protects against a rapid double-tap returning the same picker
    // entry twice.
    const additions = [...new Map(
      requestedAdditions
        .filter((input) => input.playerId || input.guestPlayerId)
        .map((input) => [
          input.playerId ? `p:${input.playerId}` : `g:${input.guestPlayerId}`,
          input,
        ]),
    ).values()];

    const actionable = additions.flatMap((input) => {
      const existing = players.find((player) =>
        (input.playerId && player.player_id === input.playerId) ||
        (input.guestPlayerId && player.guest_player_id === input.guestPlayerId)
      );
      return existing?.active ? [] : [{ input, existing }];
    });

    if (actionable.length === 0) {
      return 0;
    }

    const reactivationCount = actionable.filter(({ existing }) => !!existing).length;
    const rosterUpserts = actionable.map(({ input, existing }) => ({
        id: existing?.id ?? crypto.randomUUID(),
        event_id: event.id,
        player_id: input.playerId,
        guest_player_id: input.guestPlayerId ?? null,
        guest_name: input.guestName ?? existing?.guest_name ?? null,
        status: "active",
      }));

    try {
      await validateRosterInputsForFormat(
        actionable.map(({ input }) => input),
      );

      // One upsert statement makes a mixed batch of new players and returning
      // dropouts all-or-nothing. A policy or identity failure cannot leave
      // only half of the selected roster active.
      const { error: rosterError } = await supabase
        .from("round_robin_players")
        .upsert(rosterUpserts as never, { onConflict: "id" });
      if (rosterError) throw rosterError;

      const auditPlayers = actionable.map(({ input, existing }) => ({
        player_id: input.playerId,
        guest_player_id: input.guestPlayerId ?? null,
        guest_name: input.guestName ?? null,
        was_reactivated: !!existing,
      }));
      const { error: auditError } = await supabase
        .from("round_robin_audit")
        .insert({
          event_id: event.id,
          editor_id: userId,
          change_type: "player_add",
          changes: {
            players: auditPlayers,
            added_count: auditPlayers.length,
            reactivated_count: reactivationCount,
          },
          reason: auditPlayers.length === 1
            ? "Player added by organizer"
            : `${auditPlayers.length} players added by organizer`,
        });
      if (auditError) {
        console.error("round-robin roster batch audit failed", auditError);
      }

      // Building a draft roster is configuration, not implicit publication.
      // Keep the deliberate Generate Schedule step (and its preview) when no
      // schedule exists yet; live/established schedules still rebalance once.
      if (!hasSchedule) {
        await fetchEventDetails();
        return auditPlayers.length;
      }

      // One rebuild for the whole batch. The server reads the fresh roster,
      // preserves protected play, and recomputes every remaining obligation.
      const fromRound = event.current_round || 1;
      try {
        await regenerateScheduleFromRound(fromRound, {
          reason: auditPlayers.length === 1
            ? "Player added; future rounds rebalanced"
            : `${auditPlayers.length} players added; future rounds rebalanced`,
        });
      } catch (regenerationError) {
        console.error("post-add schedule regeneration failed", regenerationError);
        await fetchEventDetails();
        toast.warning(
          `${auditPlayers.length === 1 ? "The player was" : "The players were"} added, but the remaining schedule needs repair before play continues.`,
        );
      }

      return auditPlayers.length;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(
        message || (actionable.length === 1
          ? "Failed to add player"
          : "Failed to add players"),
      );
      console.error(error);
      await fetchEventDetails();
      throw error;
    }
  };

  const rrMutationInFlightRef = useRef(false);

  const handleMarkInactive = async (playerEventId: string) => {
    if (!event || !userId) return;
    if (rrMutationInFlightRef.current) return;

    const player = players.find(p => p.id === playerEventId);
    if (!player) return;

    // Resolved name works for registered players, reusable guests, and legacy
    // ad-hoc guests alike.
    const participantName = resolveRRParticipant(player as never).name;
    const reason = "Player removed from roster (past scores preserved)";

    // Core apply path — optionally carrying the host's decision about a live
    // match. Wrapped so both the direct case and the post-resolution case run
    // the exact same orchestration + fallback logic.
    const doRemove = async (activeMatchResolution?: { kind: ActiveMatchResolutionKind }) => {
      if (rrMutationInFlightRef.current) return;
      rrMutationInFlightRef.current = true;

      const onSuccess = async () => {
        // The `active` boolean is kept in sync with `status` by a DB trigger,
        // so all existing readers reflect the change immediately.
        await fetchEventDetails();

        // The orchestration layer only *repairs* the seats the departing
        // participant held. That can leave the remaining rounds shaped for the
        // old roster size (short-handed foursomes / stale round count), so we
        // follow every removal with a real regeneration from the first
        // unlocked round. Scored rounds and rounds with a linked match_id are
        // protected inside regenerateScheduleFromRound. This is identity-
        // agnostic: the live roster is read back from the DB and mapped by
        // player_id / guest_player_id, so guests regenerate exactly like
        // registered players.
        const fromRound = event.current_round || 1;
        const regenResult = await regenerateScheduleFromRound(fromRound, {
          expectedVersion: null,
          reason: `${participantName} removed; future rounds rebalanced`,
        }).catch((err) => {
          console.error("post-removal regeneration failed", err);
          toast.warning(
            `${participantName} was removed safely, but the optimized round count could not be applied. Use Repair schedule before continuing.`,
          );
          return null;
        });

        const roundsSuffix = regenResult?.roundsChanged
          ? `Schedule rebuilt — now ${regenResult.targetRounds} rounds.`
          : regenResult
            ? "Schedule rebuilt."
            : "";

        toast.success(
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-destructive/15 text-destructive flex items-center justify-center flex-shrink-0 mt-0.5">
              <UserMinus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base">{participantName} removed</div>
              <div className="text-sm opacity-90 leading-snug">
                They can rejoin later.{roundsSuffix ? ` ${roundsSuffix}` : ""}
              </div>
            </div>
          </div>,
          { duration: 5000 }
        );
      };

      // Prefer the Slice 2b orchestration layer (snapshot → Slice 3 planner →
      // transactional apply); it auto-escalates minimal→reoptimize so the
      // change never dead-ends on "no simple swap covers this". Returns true
      // when handled (success or a surfaced application error); false when the
      // layer is unavailable and we should fall back to the direct RPC.
      const handledByOrchestration = async (): Promise<boolean> => {
        const res = await manageParticipantWithEscalation({
          eventId: event.id,
          participantId: playerEventId,
          action: "remove",
          reason,
          activeMatchResolution,
        });
        if (res.ok) {
          await onSuccess();
          return true;
        }
        if (isInfrastructureError(res)) return false;
        toast.error(friendlyParticipantError(res));
        await fetchEventDetails();
        throw new Error(res.code ?? "remove_failed");
      };

      try {
        if (await handledByOrchestration()) return;

        // Fallback: direct transactional RPC (local-repair only).
        try {
          await callRrManageParticipant({
            eventId: event.id,
            playerId: playerEventId,
            action: "remove",
            reason,
            regenMode: "minimal",
            activeMatchResolution,
          });
          await onSuccess();
        } catch (error: unknown) {
          const err = error as RRManageParticipantError;
          toast.error(friendlyRpcError(err));
          console.error("rr_manage_participant remove failed", err);
          await fetchEventDetails();
          throw err;
        }
      } finally {
        rrMutationInFlightRef.current = false;
      }
    };

    // If this player is on court in the live round, the RPC won't touch that
    // match without an explicit decision — collect it first instead of letting
    // the change fail with a "finish the match first" toast the host can't act
    // on. When they aren't in a live match, apply immediately.
    const live = findParticipantLiveMatch(
      schedule as unknown as LiveMatchRow[],
      event.current_round,
      { playerId: player.player_id, guestPlayerId: player.guest_player_id },
    );
    if (live) {
      setPlayerManagementOpen(false);
      setActiveMatchPrompt({
        participantName: resolveRRParticipant(player as never).name,
        courtNo: live.match.court_no,
        isScored: live.isScored,
        team1Score: live.match.team1_score ?? null,
        team2Score: live.match.team2_score ?? null,
        run: (kind) => doRemove({ kind }),
      });
      return;
    }

    await doRemove();
  };


  const handleSubstitute = async (
    originalRosterId: string,
    replacement: { playerId: string | null; guestPlayerId: string | null; guestName?: string },
    scope: 'global' | number
  ) => {
    if (!event || !userId) return;
    if (rrMutationInFlightRef.current) return;
    // Acquire before format validation, which performs async profile/guest
    // reads. Otherwise two rapid taps can both clear the initial guard and
    // launch competing versioned mutations after validation resolves.
    rrMutationInFlightRef.current = true;

    try {
      // The original is identified by its roster row id, so this works for a
      // guest (no player_id) exactly as it does for a registered player.
      const original = players.find(p => p.id === originalRosterId);
      if (!original) return;

      try {
        await validateRosterInputsForFormat([replacement]);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
        throw error;
      }

      if (scope === 'global') {
        const outgoingSeatId = original.player_id
          ? `p:${original.player_id}` as SeatId
          : original.guest_player_id
            ? `g:${original.guest_player_id}` as SeatId
            : null;
        const incomingSeatId = replacement.playerId
          ? `p:${replacement.playerId}` as SeatId
          : replacement.guestPlayerId
            ? `g:${replacement.guestPlayerId}` as SeatId
            : null;
        if (!outgoingSeatId || !incomingSeatId) {
          throw new Error("The outgoing player and replacement must both have a saved identity.");
        }

        const pulse = startPulseActivity("Substituting player and rebalancing future rounds…");
        try {
          // The Edge planner proposes the post-handoff roster, then the service-
          // only database RPC commits roster lifecycle, persistent fairness
          // credit, event settings, schedule rows, version, and audit together.
          // Current/live and completed play remain byte-for-byte unchanged.
          const result = await regenerateScheduleFromRound(
            event.status === "draft" ? 1 : (event.current_round || 1),
            {
              reason: "Global substitute applied; future rounds rebalanced",
              substitutions: [{ outgoingSeatId, incomingSeatId }],
            },
          );
          const fairness = result?.fairness?.score;
          pulse.done(fairness != null ? `Substituted · ${fairness}% fairness` : "Player substituted");
          toast.success(
            event.status === "live"
              ? "Player substituted for future rounds. The current live round is unchanged."
              : "Player substituted and the schedule was rebalanced.",
          );
        } catch (error: unknown) {
          pulse.fail();
          console.error("atomic global substitution failed", error);
          await fetchEventDetails();
          toast.error(
            "We couldn't confirm the substitution. The latest roster and schedule are refreshed—verify them before retrying.",
          );
          throw error;
        }
        return;
      }

      // A one-round substitution is atomic and versioned in the database. The
      // RPC locks the complete round, rejects saved/linked play, preserves seat
      // XOR pairs for guests, and prevents the replacement from being assigned
      // twice in the same round.
      try {
        if (event.status !== "live") {
          throw new Error(
            "RR_INVALID_SUBSTITUTE:Single-round substitutions are available only during live play. Use All Future Rounds for draft roster changes.",
          );
        }
        if (event.current_round == null || scope !== event.current_round) {
          throw new Error(
            "RR_INVALID_SUBSTITUTE:Only the current live round can use a one-round substitution. Use All Future Rounds for later rounds.",
          );
        }
        const { error } = await supabase.rpc("rr_substitute_round", {
          p_request_id: crypto.randomUUID(),
          p_event_id: event.id,
          p_expected_version: event.schedule_version ?? 0,
          p_round_no: scope,
          p_original_roster_id: originalRosterId,
          p_replacement_player_id: replacement.playerId,
          p_replacement_guest_id: replacement.guestPlayerId,
          p_reason: `One-round substitution for Round ${scope}`,
        });
        if (error) throw error;

        await fetchEventDetails();
        toast.success(`Player substituted for Round ${scope}; every other round is unchanged`);
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        toast.error(
          message.includes("RR_STALE_VERSION")
            ? "The schedule changed elsewhere. Refresh before applying this substitute."
            : message.includes("RR_PROTECTED_ROUND")
              ? "That match is already started, scored, or locked. No assignment changed."
              : message.includes("RR_INVALID_SUBSTITUTE")
                ? message.split("RR_INVALID_SUBSTITUTE:").pop() || "That substitute cannot be used in this round."
                : "The substitute could not be applied. Nothing changed.",
        );
        console.error(error);
        await fetchEventDetails();
        throw error;
      }
    } finally {
      rrMutationInFlightRef.current = false;
    }
  };


  const handleApplyScheduleSettings = async ({
    numCourts,
    gamesPerPlayer,
  }: {
    numCourts: number;
    gamesPerPlayer: number;
  }) => {
    if (!event || !userId) return;

    const courtsChanged = numCourts !== event.num_courts;
    const gamesChanged = gamesPerPlayer !== (event.games_per_player || 3);
    if (!courtsChanged && !gamesChanged) return;

    const activePlayerCount = players.filter((player) => player.active !== false).length;
    const isPreScheduleSetup = schedule.length === 0 && activePlayerCount < 4;

    if (isPreScheduleSetup) {
      const estimatePlayerCount = Math.max(4, activePlayerCount, event.max_players ?? 0);
      const estimatedRounds = suggestRounds(estimatePlayerCount, numCourts, gamesPerPlayer);
      const pulse = startPulseActivity("Saving courts and game target…");

      try {
        // One guarded row update keeps the saved configuration internally
        // consistent while avoiding schedule generation below four players.
        // The version predicate prevents a stale client from overwriting
        // settings if another host generated a schedule in the meantime.
        const { data: updatedEvent, error } = await supabase
          .from("round_robin_events")
          .update({
            num_courts: numCourts,
            games_per_player: gamesPerPlayer,
            num_rounds: estimatedRounds,
            schedule_version: (event.schedule_version ?? 0) + 1,
          })
          .eq("id", event.id)
          .eq("schedule_version", event.schedule_version ?? 0)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!updatedEvent) {
          throw new Error("The event changed elsewhere. Refresh and review the latest setup before saving again.");
        }

        await fetchEventDetails();
        pulse.done(`Setup saved · estimated ${estimatedRounds} ${estimatedRounds === 1 ? "round" : "rounds"}`);
        toast.success("Courts and game target saved. Generate the schedule when at least four active players are ready.");
        return;
      } catch (error: unknown) {
        pulse.fail();
        const message = getErrorMessage(error, "Failed to save schedule setup");
        toast.error(message);
        console.error(error);
        await fetchEventDetails();
        throw error;
      }
    }

    const fromRound = event.status === "draft" ? 1 : (event.current_round || 1);
    const pulse = startPulseActivity("Rebalancing courts, games, and rests…");
    try {
      const reasonParts = [
        courtsChanged ? `courts ${event.num_courts}→${numCourts}` : null,
        gamesChanged ? `games/player ${event.games_per_player || 3}→${gamesPerPlayer}` : null,
      ].filter(Boolean);
      const result = await regenerateScheduleFromRound(fromRound, {
        numCourts,
        gamesPerPlayer,
        reason: `Host changed ${reasonParts.join(" and ")}`,
      });

      const targetRounds = result?.targetRounds ?? event.num_rounds;
      const fairness = result?.fairness?.score;
      pulse.done(
        fairness != null
          ? `Rebuilt · ${targetRounds} rounds · ${fairness}% fairness`
          : `Rebuilt · ${targetRounds} rounds`,
      );
      toast.success(
        result?.impact?.summary ||
          `Schedule rebuilt for ${numCourts} ${numCourts === 1 ? "court" : "courts"} and ${gamesPerPlayer} games per player.`,
      );
    } catch (error: unknown) {
      pulse.fail();
      const message = getErrorMessage(error);
      if (message.includes("FunctionsHttpError")) {
        toast.error("The schedule could not be safely rebuilt. Refresh and try again; no protected play was changed.");
      } else {
        toast.error(message || "Failed to rebuild schedule");
      }
      console.error(error);
      await fetchEventDetails();
      throw error;
    }
  };

  const applyAtomicScheduleEdit = async ({
    action,
    matchId,
    secondMatchId = null,
    newCourtNo = null,
  }: {
    action: "rotate_partners" | "swap_opponents" | "move_court";
    matchId: string;
    secondMatchId?: string | null;
    newCourtNo?: number | null;
  }) => {
    if (!event) return;

    const { error } = await supabase.rpc("rr_edit_schedule", {
      p_request_id: crypto.randomUUID(),
      p_event_id: event.id,
      p_expected_version: event.schedule_version ?? 0,
      p_action: action,
      p_match_id: matchId,
      p_second_match_id: secondMatchId,
      p_new_court_no: newCourtNo,
      p_reason: null,
    });
    if (error) throw error;
    await fetchEventDetails();
  };

  const handleRotatePartners = async (matchId: string) => {
    try {
      await applyAtomicScheduleEdit({ action: "rotate_partners", matchId });
      toast.success("Partners rotated — both teams now have a new pairing");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(
        message.includes("RR_STALE_VERSION")
          ? "The schedule changed elsewhere. Refresh and review it before editing."
          : message.includes("RR_PROTECTED_ROUND")
            ? "That round is already in play or has a saved result, so it remains locked."
            : "The partner rotation could not be applied. Nothing changed.",
      );
      console.error(error);
      await fetchEventDetails();
      throw error;
    }
  };

  const handleSwapOpponents = async (match1Id: string, match2Id: string) => {
    try {
      await applyAtomicScheduleEdit({
        action: "swap_opponents",
        matchId: match1Id,
        secondMatchId: match2Id,
      });
      toast.success("Opponent teams swapped");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(
        message.includes("RR_STALE_VERSION")
          ? "The schedule changed elsewhere. Refresh and review it before editing."
          : message.includes("RR_PROTECTED_ROUND")
            ? "One of those matches is already in play or scored, so both stayed unchanged."
            : "The opponent swap could not be applied. Nothing changed.",
      );
      console.error(error);
      await fetchEventDetails();
      throw error;
    }
  };

  const handleMoveCourt = async (matchId: string, newCourtNo: number) => {
    const match = schedule.find((row) => row.id === matchId);
    const destinationOccupied = !!match && schedule.some((row) =>
      row.id !== matchId &&
      row.round_no === match.round_no &&
      !row.is_bye &&
      row.court_no === newCourtNo
    );

    try {
      await applyAtomicScheduleEdit({
        action: "move_court",
        matchId,
        newCourtNo,
      });
      toast.success(
        destinationOccupied
          ? `Court ${match?.court_no} and Court ${newCourtNo} assignments swapped`
          : `Match moved to Court ${newCourtNo}`,
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(
        message.includes("RR_STALE_VERSION")
          ? "The schedule changed elsewhere. Refresh and review it before editing."
          : message.includes("RR_PROTECTED_ROUND")
            ? "That court assignment is already in play or scored, so nothing changed."
            : "The court move could not be applied. Nothing changed.",
      );
      console.error(error);
      await fetchEventDetails();
      throw error;
    }
  };

  const handleEditMatchScore = async (matchId: string, team1Score: number, team2Score: number) => {
    if (!event || !userId) return;

    try {
      // matchId is the round_robin_schedule.id. submit_rr_match_score
      // handles the full edit path: updates schedule + matches +
      // match_participants, resets verification, writes the audit log,
      // and (when the match row already exists) updates the linked
      // matches row in place so ratings stay correct.
      const { error } = await supabase.rpc("submit_rr_match_score", {
        p_schedule_id: matchId,
        p_team1_score: team1Score,
        p_team2_score: team2Score,
      });

      if (error) throw error;

      toast.success("Score updated");
      await fetchEventDetails();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update score"));
      console.error(error);
      throw error;
    }
  };

  const handleVoidMatch = async (matchId: string) => {
    if (!event || !userId) return;

    try {
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      // If match is linked to matches table, void it there
      if (match.match_id) {
        await supabase
          .from("matches")
          .update({
            voided: true,
            voided_by: userId,
            voided_at: new Date().toISOString(),
            void_reason: "Voided via Round Robin editor",
          })
          .eq("id", match.match_id);

        // Recalculate ratings if event is rating eligible (and not a guest event)
        if (event.rating_eligible && !event.allow_guests) {
          await supabase.rpc("recalculate_all_ratings");
        }
      }

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "match_void",
        changes: {
          match_id: matchId,
          schedule_match_id: match.match_id,
        },
        reason: `Match voided for Round ${match.round_no}, Court ${match.court_no}`,
      });

      toast.success("Match voided and removed from ratings");
      await fetchEventDetails();
    } catch (error: unknown) {
      toast.error("Failed to void match");
      console.error(error);
      throw error;
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!event || !userId || !isAdmin) return;

    try {
      const match = schedule.find(m => m.id === matchId);
      if (!match) return;

      // Delete from matches table if linked
      if (match.match_id) {
        // Delete match participants first
        await supabase
          .from("match_participants")
          .delete()
          .eq("match_id", match.match_id);

        // Delete match
        await supabase
          .from("matches")
          .delete()
          .eq("id", match.match_id);

        // Recalculate ratings if event is rating eligible (and not a guest event)
        if (event.rating_eligible && !event.allow_guests) {
          await supabase.rpc("recalculate_all_ratings");
        }
      }

      // Clear scores from schedule
      await supabase
        .from("round_robin_schedule")
        .update({
          team1_score: null,
          team2_score: null,
          match_id: null,
        })
        .eq("id", matchId);

      // Audit entry
      await supabase.from("round_robin_audit").insert({
        event_id: event.id,
        editor_id: userId,
        change_type: "match_delete",
        changes: {
          match_id: matchId,
          schedule_match_id: match.match_id,
        },
        reason: `Match deleted by admin for Round ${match.round_no}, Court ${match.court_no}`,
      });

      toast.success("Match deleted and ratings reflowed");
      await fetchEventDetails();
    } catch (error: unknown) {
      toast.error("Failed to delete match");
      console.error(error);
      throw error;
    }
  };

  const handleLeaveEvent = async () => {
    if (!userId || !event) return;

    // Validation checks
    if (isOrganizer) {
      toast.error("Organizers cannot leave their own events");
      return;
    }

    if (event.status === 'live' || event.status === 'completed') {
      toast.error("Cannot leave event that has already started");
      return;
    }

    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      toast.error("Registration deadline has passed");
      return;
    }

    try {
      const { error } = await supabase
        .from('round_robin_players')
        .update({
          status: 'withdrawn' as never,
          withdrawn_at: new Date().toISOString(),
          withdrawal_reason: 'Player left before the event started',
        })
        .eq('event_id', event.id)
        .eq('player_id', userId);

      if (error) throw error;

      toast.success(`You have left ${event.name}`);
      setLeaveDialogOpen(false);
      navigate(backHref);
    } catch (error: unknown) {
      console.error('Leave error:', error);
      toast.error('Failed to leave event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative h-16 w-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted-foreground font-medium">Loading event...</p>
        </motion.div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-4">Event not found</p>
          <Button onClick={() => navigate(backHref)} variant="outline">
            Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  // Non-organizers see simplified view
  if (!isOrganizer && !isAdmin) {
    return <PlayerRoundRobinView eventId={id || ""} userId={userId} />;
  }

  // Organizers and admins see full view
  const activeRoster = players.filter((player) => player.active !== false);
  const hasSchedule = schedule.length > 0;
  const canGenerate = activeRoster.length >= 4;
  const hasScores = schedule.some(m => m.team1_score !== null || m.team2_score !== null);
  const currentRound = event.current_round || 1;

  const buildScheduleImpactPlan = ({
    numCourts,
    gamesPerPlayer,
  }: {
    numCourts: number;
    gamesPerPlayer: number;
  }): ScheduleAdjustmentPlan | null => {
    const toSeatId = (playerId: string | null, guestId: string | null): SeatId | null =>
      playerId ? `p:${playerId}` : guestId ? `g:${guestId}` : null;
    const activeSeatIds = activeRoster
      .map((player) => toSeatId(player.player_id, player.guest_player_id))
      .filter((seat): seat is SeatId => seat !== null);
    const coreMatches: CoreMatch[] = schedule
      .filter((match) => !match.abandoned)
      .map((match) => ({
        round_no: match.round_no,
        court_no: match.court_no,
        is_bye: match.is_bye,
        a1: toSeatId(match.a1_player_id, match.a1_guest_id),
        a2: toSeatId(match.a2_player_id, match.a2_guest_id),
        b1: toSeatId(match.b1_player_id, match.b1_guest_id),
        b2: toSeatId(match.b2_player_id, match.b2_guest_id),
      }));
    const scheduledSeats = [...new Set(coreMatches.flatMap(seatsOf))];
    const previousSeatIds = scheduledSeats.length > 0 ? scheduledSeats : activeSeatIds;
    const protectedRounds = schedule
      .filter((match) =>
        match.locked_at != null ||
        match.match_id != null ||
        match.team1_score != null ||
        match.team2_score != null ||
        match.abandoned === true ||
        (event.status === "live" && match.round_no <= currentRound)
      )
      .map((match) => match.round_no);
    const protectedThrough = Math.max(0, ...protectedRounds);
    const firstMutableRound = Math.max(
      event.status === "draft" ? 1 : currentRound,
      protectedThrough + 1,
    );
    const genders = new Map<SeatId, string>();
    const existingGameCredits = new Map<SeatId, number>();
    const existingFirstEligibleRounds = new Map<SeatId, number>();
    activeRoster.forEach((player) => {
      const seat = toSeatId(player.player_id, player.guest_player_id);
      if (player.player_id && player.profiles?.gender) {
        genders.set(`p:${player.player_id}`, player.profiles.gender);
      }
      const guestGender = player.guest_players?.effective_gender ?? player.guest_players?.gender;
      if (player.guest_player_id && guestGender) {
        genders.set(`g:${player.guest_player_id}`, guestGender);
      }
      if (seat && (player.schedule_game_credit ?? 0) > 0) {
        existingGameCredits.set(seat, player.schedule_game_credit ?? 0);
      }
      if (seat && (player.schedule_first_eligible_round ?? 0) >= 1) {
        existingFirstEligibleRounds.set(
          seat,
          player.schedule_first_eligible_round as number,
        );
      }
    });

    return planScheduleAdjustment({
      seed: event.id,
      currentMatches: coreMatches,
      currentSeatIds: previousSeatIds,
      nextSeatIds: activeSeatIds,
      currentNumCourts: event.num_courts,
      currentGamesPerPlayer: event.games_per_player || 3,
      currentTotalRounds: event.num_rounds,
      firstMutableRound,
      protectedRounds,
      numCourts,
      gamesPerPlayer,
      format: (event.format || "open") as EventFormat,
      genders,
      lateJoinCredit: "roster_median",
      existingGameCredits,
      existingFirstEligibleRounds,
    });
  };

  const getImpactPlayerName = (seatId: SeatId) => getPlayerName(seatId.slice(2));

  const currentSchedulePlan = hasSchedule
    ? buildScheduleImpactPlan({
        numCourts: event.num_courts,
        gamesPerPlayer: event.games_per_player || 3,
      })
    : null;
  const repairFromRound = currentSchedulePlan
    ? currentSchedulePlan.capacity.protectedThroughRound + 1
    : (event.status === "draft" ? 1 : currentRound + 1);
  const adjustableRows = schedule.filter((match) => match.round_no >= repairFromRound);
  const adjustableRoundNumbers = [...new Set(adjustableRows.map((match) => match.round_no))];
  const mutableShapeDrift = !!currentSchedulePlan?.ok && adjustableRoundNumbers.some((roundNo) => {
    const rows = adjustableRows.filter((match) => match.round_no === roundNo);
    const playable = rows.filter((match) => !match.is_bye).length;
    const assignedIdentities = rows.reduce((count, match) => {
      return count + [
        match.a1_player_id ?? match.a1_guest_id,
        match.a2_player_id ?? match.a2_guest_id,
        match.b1_player_id ?? match.b1_guest_id,
        match.b2_player_id ?? match.b2_guest_id,
      ].filter(Boolean).length;
    }, 0);
    return playable !== currentSchedulePlan.capacity.matchesPerRound || assignedIdentities !== activeRoster.length;
  });
  const scheduleRoundDrift = !!currentSchedulePlan?.ok && (
    currentSchedulePlan.capacity.recommendedTotalRounds !== event.num_rounds ||
    (event.num_rounds >= repairFromRound &&
      adjustableRoundNumbers.length !== event.num_rounds - repairFromRound + 1)
  );
  const scheduleStructureDrift = !!currentSchedulePlan && (
    currentSchedulePlan.fairness.duplicateSeatAssignments > 0 ||
    currentSchedulePlan.fairness.underfilledMatches > 0
  );
  const needsScheduleRepair = hasSchedule && (
    currentSchedulePlan?.ok === false ||
    mutableShapeDrift ||
    scheduleRoundDrift ||
    scheduleStructureDrift
  );

  // Calculate progress step
  const getCurrentStep = () => {
    if (activeRoster.length < 4) return 1;
    if (!hasSchedule) return 2;
    if (event.status === 'live' || hasScores) return 3;
    if (event.status === 'completed') return 4;
    return 2;
  };

  const currentStep = getCurrentStep();

  // Estimate rounds and time
  const estimatedRounds = hasSchedule ? event.num_rounds : suggestRounds(activeRoster.length, event.num_courts, event.games_per_player || 3);
  const estimatedMinutes = estimatedRounds * 12;

  // Share functionality
  const handleShareEvent = () => {
    const eventUrl = `${window.location.origin}/round-robin/${event.id}`;
    if (navigator.share) {
      navigator.share({
        title: event.name,
        text: `Join the Round Robin event: ${event.name}`,
        url: eventUrl,
      }).catch(() => {
        navigator.clipboard.writeText(eventUrl);
        toast.success("Event link copied to clipboard!");
      });
    } else {
      navigator.clipboard.writeText(eventUrl);
      toast.success("Event link copied to clipboard!");
    }
  };

  // Get player initials
  const getPlayerInitials = (player: Player) => {
    const name =
      player.profiles?.display_name ||
      player.profiles?.full_name ||
      (player as any).guest_players?.display_name ||
      (player as any).guest_name ||
      "Guest";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handler for the overflow menu "Regenerate schedule" action.
  // Wraps the existing regenerateScheduleFromRound helper with a
  // confirm + toast envelope, matching what the old inline button did.
  const handleRegenerateSchedule = async () => {
    setRegenConfirmOpen(true);
  };

  // Actual rebuild, run once the styled confirmation is accepted.
  const runRegenerateSchedule = async () => {
    setRegenConfirmOpen(false);
    const pulse = startPulseActivity(hasSchedule ? "Rebalancing schedule…" : "Building schedule…");
    try {
      const result = await regenerateScheduleFromRound(1, {
        reason: hasSchedule
          ? "Host requested a schedule rebalance"
          : "Initial schedule generated",
      });
      const fairness = result?.fairness?.score;
      const rounds = result?.targetRounds ?? event.num_rounds;
      pulse.done(
        fairness != null
          ? `Schedule ready · ${rounds} rounds · ${fairness}% fairness`
          : `Schedule ready · ${rounds} rounds`,
      );
      toast.success(
        result?.impact?.summary ||
          (hasSchedule ? "The adjustable schedule was rebalanced." : "Schedule generated successfully."),
      );
    } catch (error: unknown) {
      pulse.fail();
      console.error(error);
      await fetchEventDetails();
      toast.error(
        "We couldn't confirm the schedule update. The latest schedule is refreshed—verify it before retrying.",
      );
    }
  };

  const handleRepairSchedule = async () => {
    if (repairingSchedule) return;
    setRepairingSchedule(true);
    const pulse = startPulseActivity("Repairing schedule consistency…");
    try {
      const result = await regenerateScheduleFromRound(
        event.status === "draft" ? 1 : currentRound,
        { reason: "Host repaired schedule configuration drift" },
      );
      const fairness = result?.fairness?.score;
      pulse.done(
        fairness != null
          ? `Schedule repaired · ${fairness}% fairness`
          : "Schedule repaired",
      );
      toast.success(result?.impact?.summary || "The schedule now matches the roster, courts, and game target.");
    } catch (error) {
      pulse.fail();
      console.error("schedule repair failed", error);
      await fetchEventDetails();
      toast.error(
        "We couldn't confirm the repair. The latest schedule is refreshed—verify it before retrying.",
      );
    } finally {
      setRepairingSchedule(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Slim top bar — back · "Round Robin" · share · overflow.
          Replaces the global PULSE/Bell/Profile/Theme/Sign-out toolbar
          on this route so the host has a focused command-center surface
          and prime mobile real estate isn't eaten by app-wide chrome. */}
      <RoundRobinTopBar
        backHref={backHref}
        onShare={isOrganizer || isParticipant ? handleShareEvent : undefined}
        overflow={
          isOrganizer && !event.voided ? (
            <HostControlsMenu
              status={event.status}
              hasSchedule={hasSchedule}
              isEditMode={isEditMode}
              canDestroy={isOrganizer}
              onSettings={() => setEditDialogOpen(true)}
              onCourtsAndGames={() => setCourtsRoundsOpen(true)}
              onRegenerateSchedule={handleRegenerateSchedule}
              onEditSchedule={() => setScheduleEditorOpen(true)}
              onScoreCorrections={() => setScoreManagementOpen(true)}
              onActivityLog={() => setAuditHistoryOpen(true)}
              onOpenKiosk={() => {
                const kioskUrl = `/round-robin/${event.id}/kiosk`;
                window.open(kioskUrl, "_blank", "width=1920,height=1080");
              }}
              onDeleteOrVoid={() => setDeleteDialogOpen(true)}
            />
          ) : undefined
        }
      />

      {isEditMode && (
        <div className="bg-warning/20 border-b border-warning">
          <div className="container mx-auto px-4 py-2">
            <p className="text-sm text-warning-foreground font-medium text-center">
              Edit Mode Active — Make changes to {event.name}
            </p>
          </div>
        </div>
      )}

      <div className="pb-20">
        {/* Consolidated host hero — title, status, metadata, invite code.
            No action row here; primary action lives in WhatsNextBanner
            below, secondary actions live in the top-bar overflow menu. */}
        <RoundRobinHostHero
          name={event.name}
          date={event.date}
          startTime={event.start_time}
          status={event.status}
          voided={event.voided}
          ratingEligible={event.rating_eligible}
          allowGuests={event.allow_guests}

          format={event.format}
          numRounds={event.num_rounds}
          numCourts={event.num_courts}
          playerCount={activeRoster.length}
          hasSchedule={hasSchedule}
          inviteCode={event.invite_code}
          registrationMode={event.registration_mode}
          eventId={event.id}
          location={event.location}
          canEditLocation={isOrganizer}
          onLocationUpdated={fetchEventDetails}
        />

        {/* Leave button for participants — kept here, just out of the hero.
            Compact, only shown when relevant. */}
        {!isOrganizer &&
          isParticipant &&
          !event.voided &&
          event.status === "draft" &&
          (!event.registration_deadline || new Date() < new Date(event.registration_deadline)) && (
            <div className="container max-w-2xl mx-auto px-4 -mt-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeaveDialogOpen(true)}
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                Leave Event
              </Button>
            </div>
          )}

      <main className="container max-w-[1280px] lg:max-w-[1536px] mx-auto px-4 pt-3 pb-6">
        {/* Desktop management console: 3-column grid at lg+.
            On mobile the grid classes are inert (block), the sidebars
            are display:none, and the center column renders exactly the
            existing single-column flow — mobile is unchanged. */}
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
          {/* LEFT — setup progress, quick actions, status (desktop only) */}
          {isOrganizer && (
            <aside className="hidden lg:block">
              <RRLeftSidebar
                playerCount={activeRoster.length}
                hasSchedule={hasSchedule}
                status={event.status}
                format={event.format}
                date={event.date}
                startTime={event.start_time}
                location={event.location}
                ratingEligible={event.rating_eligible}
                allowGuests={event.allow_guests}
                onAddPlayers={() => setPlayerManagementOpen(true)}
                onGenerateSchedule={handleGenerateSchedule}
                onEditEvent={handleToggleEditMode}
                onGoToPlayers={() => setActiveTab('players')}
              />
            </aside>
          )}

          {/* CENTER — primary working area (existing flow, untouched) */}
          <div className="min-w-0">
        {isOrganizer && isEditMode && (
          <div className="mb-6">
            <EditModeBanner
              isEditMode={isEditMode}
              eventName={event.name}
              hasUnsavedChanges={hasUnsavedChanges}
              onToggleEdit={handleToggleEditMode}
            />
          </div>
        )}

        {/* Removed: the redundant "Add or confirm players" Alert
            (duplicate of WhatsNextBanner's prompt) and the four-dot
            lifecycle stepper (also a duplicate). The InviteCodeCard
            is folded inline into the new RoundRobinHostHero. The host
            now sees exactly one primary action surface — the
            WhatsNextBanner — below the hero. */}

        {isOrganizer && needsScheduleRepair && !event.voided && event.status !== "completed" && (
          <Alert className="mb-4 overflow-hidden border-amber-500/35 bg-gradient-to-r from-amber-500/[0.11] via-card to-card shadow-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="ml-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Schedule and event settings are out of sync</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {currentSchedulePlan?.ok === false
                    ? currentSchedulePlan.warnings.find((warning) => warning.severity === "error")?.message
                    : `The saved rotation does not fully reflect ${event.num_courts} ${event.num_courts === 1 ? "court" : "courts"}, ${activeRoster.length} active players, and a ${event.games_per_player || 3}-game target.`}{" "}
                  Current, completed, and scored play stays locked; repair begins with Round {repairFromRound}.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleRepairSchedule}
                disabled={repairingSchedule || currentSchedulePlan?.ok === false}
                className="h-9 shrink-0 gap-1.5 self-start sm:self-center"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", repairingSchedule && "animate-spin")} />
                {repairingSchedule ? "Repairing…" : "Repair schedule"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* What's next — the single host action surface.
            All earlier duplicates (lifecycle stepper, Alert,
            standalone InviteCodeCard) have been removed in favor of
            this. The hero answers "what IS this event?", this banner
            answers "what should I do right now?" */}
        {isOrganizer && (
          <div className="mb-4 max-w-2xl lg:max-w-none mx-auto">
            <WhatsNextBanner
              status={event.status}
              voided={event.voided}
              hasPlayers={activeRoster.length >= 4}
              hasSchedule={hasSchedule}
              playerCount={activeRoster.length}
              courtCount={event.num_courts}
              currentRound={event.current_round}
              totalRounds={event.num_rounds}
              currentRoundScoredCount={
                event.current_round != null
                  ? schedule.filter(
                      (m) =>
                        m.round_no === event.current_round &&
                        !m.is_bye &&
                        m.team1_score != null &&
                        m.team2_score != null,
                    ).length
                  : 0
              }
              currentRoundTotalCount={
                event.current_round != null
                  ? schedule.filter(
                      (m) => m.round_no === event.current_round && !m.is_bye,
                    ).length
                  : 0
              }
              isOrganizer={isOrganizer}
              onAddPlayers={() => setPlayerManagementOpen(true)}
              onGenerateSchedule={handleGenerateSchedule}
              onStartEvent={handleStartEvent}
              onCloseRound={() => event.current_round && handleCloseRound(event.current_round)}
              onCompleteEvent={handleCompleteEvent}
              onManageRound={() => setScoreManagementOpen(true)}
            />
          </div>
        )}

        <div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          {/* Premium tab strip — sliding primary underline indicator.
              Mirrors the MatchHistory pattern (and PlayerShell's bottom
              nav) so the visual language carries across the app. The
              hidden shadcn TabsList stays mounted to satisfy Radix's
              accessibility tree without rendering its pill chrome. */}
          {(() => {
            const tabs: { value: typeof activeTab; label: string; icon: typeof Calendar; count?: number }[] = [
              { value: "schedule", label: "Schedule", icon: Calendar },
              { value: "players", label: "Players", icon: Users, count: activeRoster.length },
              { value: "standings", label: "Standings", icon: Trophy },
            ];
            const activeIndex = tabs.findIndex((t) => t.value === activeTab);
            return (
              <div className="relative border-b border-border/40 max-w-md mx-auto mb-4">
                <div className="grid grid-cols-3">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.value === activeTab;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setActiveTab(tab.value)}
                        className={cn(
                          "relative inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors duration-200",
                          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                        {tab.count != null && (
                          <span className={cn(
                            "ml-0.5 text-xs font-semibold tabular-nums transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground/70"
                          )}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Sliding underline indicator */}
                <div
                  className="absolute bottom-0 h-[2px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
                  style={{
                    width: `${100 / tabs.length}%`,
                    left: `${(100 / tabs.length) * activeIndex}%`,
                  }}
                />
              </div>
            );
          })()}
          <TabsList className="sr-only">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-4 space-y-4">
            {!hasSchedule ? (
              <Card className="border-dashed border-2 bg-gradient-to-br from-card to-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                    <Zap className="h-12 w-12 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold">No schedule yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Add or confirm players, then generate your schedule.
                    </p>
                    {activeRoster.length >= 4 && (
                      <p className="text-xs text-muted-foreground">
                        With {activeRoster.length} players you'll typically see ~{estimatedRounds} rounds (~{estimatedMinutes} min)
                      </p>
                    )}
                  </div>
                  {isOrganizer && (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <Button 
                        onClick={handleGenerateSchedule} 
                        disabled={!canGenerate}
                        size="lg"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Schedule
                      </Button>
                      {activeRoster.length < 4 && (
                        <Button 
                          variant="link" 
                          size="sm"
                          onClick={() => {
                            const playersTab = document.querySelector('[value="players"]') as HTMLElement;
                            playersTab?.click();
                          }}
                        >
                          Review players
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {isOrganizer && event.status === "live" && (
                  <Button 
                    onClick={handleCompleteEvent} 
                    className="w-full mb-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Event & Submit to Match History
                  </Button>
                )}



                <ScheduleRoundCarousel 
                  totalRounds={event.num_rounds} 
                  currentRound={event.current_round || 1}
                  rightAction={
                    isOrganizer && !event.voided && event.status !== 'completed' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setScheduleEditorOpen(true)}
                          className="text-primary hover:text-primary hover:bg-primary/10 gap-1.5 h-9 px-2.5"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="text-sm font-medium">Edit schedule</span>
                        </Button>
                        {hasScores && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setScoreManagementOpen(true)}
                            className="text-muted-foreground hover:text-foreground h-9 w-9 p-0"
                            aria-label="Manage scores"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : undefined
                  }
                >
                  {(roundNo, isActiveSlide) => {
                    const allMatches = getRoundMatches(roundNo);
                    const courtMatches = allMatches.filter(m => !m.is_bye);
                    const byeMatches = allMatches.filter(m => m.is_bye);
                    const isCurrentRound = roundNo === currentRound;
                    const isFutureRound = roundNo > currentRound;
                    const allRoundScored = courtMatches.every(m => m.team1_score !== null && m.team2_score !== null);
                    
                    return (
                      <div className={`space-y-3 ${isFutureRound ? 'opacity-60' : ''}`}>
                        {/* Section label + optional close-round action */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Court Assignments
                            {isCurrentRound && event.status === 'live' && (
                              <span className="ml-2 inline-flex items-center gap-1 text-primary normal-case font-bold tracking-normal">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                                </span>
                                Active
                              </span>
                            )}
                          </div>
                          {isOrganizer && event.status === "live" && isCurrentRound && allRoundScored && roundNo < event.num_rounds && (
                            <Button 
                              size="sm" 
                              onClick={() => handleCloseRound(roundNo)}
                              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-8"
                            >
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                              Close Round
                            </Button>
                          )}
                        </div>

                        
                        {/* grid-cols-1 is load-bearing on mobile: without an
                            explicit track the implicit column sizes to its
                            content (min-content), so a long doubles pairing
                            blows the card ~20px past the carousel slide and
                            gets clipped. minmax(0,1fr) (what grid-cols-1
                            compiles to) pins the track to the container so the
                            name truncation below can actually kick in. */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {courtMatches.map((match, idx) => {
                            const isCompleted = match.team1_score !== null && match.team2_score !== null;
                            const team1Won = isCompleted && match.team1_score! > match.team2_score!;
                            const team2Won = isCompleted && match.team2_score! > match.team1_score!;

                            return (
                              <motion.div
                                key={match.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                              >
                                <Card className={`overflow-hidden transition-all hover:shadow-md ${
                                  isFutureRound ? 'pointer-events-none' : ''
                                } ${isCompleted ? 'bg-gradient-to-r from-card to-muted/30' : ''}`}>
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="font-mono bg-muted/50">Court {match.court_no}</Badge>
                                      {isCompleted && (
                                        <Badge variant="secondary" className="text-xs">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Completed
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className={`flex items-center gap-2 p-3 rounded-xl transition-colors ${
                                        team1Won 
                                          ? 'bg-primary/15 border border-primary/30' 
                                          : 'bg-muted/50'
                                      }`}>
                                        {team1Won && <Trophy className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                        <SeatAvatars seats={[
                                          { name: getSeatName(match, 'a1'), avatarUrl: getSeatAvatar(match, 'a1') },
                                          { name: getSeatName(match, 'a2'), avatarUrl: getSeatAvatar(match, 'a2') },
                                        ]} />
                                        <TeamNamesStack
                                          className="flex-1"
                                          isWinner={team1Won}
                                          player1={getSeatName(match, 'a1')}
                                          player2={getSeatName(match, 'a2')}
                                        />
                                        {match.team1_score !== null ? (
                                          <div className={`text-xl font-bold font-mono ml-1 flex-shrink-0 ${team1Won ? 'text-primary' : ''}`}>{match.team1_score}</div>
                                        ) : isOrganizer && event.status === "live" && isCurrentRound ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            max="99"
                                            inputMode="numeric"
                                            className="w-16 h-11 text-center text-lg font-bold tabular-nums ml-1 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
                                            placeholder="0"
                                            value={scores[match.id]?.team1_score ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                                          />
                                        ) : (
                                          <div className="text-muted-foreground ml-1 flex-shrink-0">—</div>
                                        )}
                                      </div>
                                      
                                      <div className={`flex items-center gap-2 p-3 rounded-xl transition-colors ${
                                        team2Won 
                                          ? 'bg-primary/15 border border-primary/30' 
                                          : 'bg-muted/50'
                                      }`}>
                                        {team2Won && <Trophy className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                        <SeatAvatars seats={[
                                          { name: getSeatName(match, 'b1'), avatarUrl: getSeatAvatar(match, 'b1') },
                                          { name: getSeatName(match, 'b2'), avatarUrl: getSeatAvatar(match, 'b2') },
                                        ]} />
                                        <TeamNamesStack
                                          className="flex-1"
                                          isWinner={team2Won}
                                          player1={getSeatName(match, 'b1')}
                                          player2={getSeatName(match, 'b2')}
                                        />
                                        {match.team2_score !== null ? (
                                          <div className={`text-xl font-bold font-mono ml-1 flex-shrink-0 ${team2Won ? 'text-primary' : ''}`}>{match.team2_score}</div>
                                        ) : isOrganizer && event.status === "live" && isCurrentRound ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            max="99"
                                            inputMode="numeric"
                                            className="w-16 h-11 text-center text-lg font-bold tabular-nums ml-1 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
                                            placeholder="0"
                                            value={scores[match.id]?.team2_score ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                                          />
                                        ) : (
                                          <div className="text-muted-foreground ml-1 flex-shrink-0">—</div>
                                        )}
                                      </div>
                                    </div>

                                    
                                    {isOrganizer && event.status === "live" && isCurrentRound && match.team1_score === null && (
                                      <Button
                                        onClick={() => handleSaveScore(match)}
                                        disabled={savingScore === match.id}
                                        size="sm"
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                      >
                                        {savingScore === match.id ? "Saving..." : "Save Score"}
                                      </Button>
                                    )}
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>

                        {byeMatches.length > 0 && (
                          <div className="mt-3 rounded-2xl border border-border/50 bg-muted/30 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold tracking-wider uppercase">
                                Bye
                              </span>
                              <span className="text-xs text-muted-foreground">Players resting this round</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {byeMatches.map((match) => (
                                <span
                                  key={match.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/60 text-xs font-medium text-foreground"
                                >
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  {getSeatName(match, 'a1')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }}
                </ScheduleRoundCarousel>
              </>
            )}
          </TabsContent>

          <TabsContent value="players" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Participants</CardTitle>
                  {isOrganizer && !event.voided && event.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlayerManagementOpen(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Manage Players
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.length > 0 && (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Players ({activeRoster.length} active)
                      </p>
                      {players.map((player) => {
                        const guest = (player as any).guest_players as { id?: string; display_name?: string; linked_user_id?: string | null; email?: string | null } | undefined;
                        const guestId = (player as any).guest_player_id as string | null | undefined;
                        const guestName = guest?.display_name || (player as any).guest_name;
                        const isUnlinkedGuest = !!guestId && !guest?.linked_user_id;
                        const displayName =
                          player.profiles?.display_name ||
                          player.profiles?.full_name ||
                          (guestName ? (guest?.linked_user_id ? guestName : `${guestName} (G)`) : "Guest");
                        return (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="font-medium">
                            {displayName}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={player.active === false ? "secondary" : "default"}>
                              {player.active === false ? "Inactive" : "Active"}
                            </Badge>
                            {isOrganizer && isUnlinkedGuest && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setInviteGuest({
                                  id: guestId!,
                                  name: guestName || "Guest",
                                  email: guest?.email ?? null,
                                })}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Invite
                              </Button>
                            )}
                            {isOrganizer && player.active !== false && !event.voided && event.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  if (!confirm(`Remove ${displayName} from this event?`)) return;
                                  
                                  await handleMarkInactive(player.id);
                                }}
                                title="Remove player"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="mt-6 space-y-6">
            {/* Top 3 Leaderboard - only active players */}
            {standings.filter(s => !s.isRemoved).length >= 3 && (
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Top 3 Leaders</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {standings.filter(s => !s.isRemoved).slice(0, 3).map((row, idx) => (
                      <div
                        key={row.player_id}
                        className={`relative p-4 rounded-xl border ${
                          idx === 0
                            ? 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-400/50 dark:border-amber-500/30'
                            : idx === 1
                            ? 'bg-slate-50/60 dark:bg-slate-500/5 border-slate-400/50 dark:border-slate-500/30'
                            : 'bg-orange-50/60 dark:bg-orange-500/5 border-orange-400/50 dark:border-orange-500/30'
                        }`}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <RankBadge rank={idx + 1} variant="tile" />
                          <div className="font-semibold text-sm line-clamp-1 text-center">
                            {row.player_name}
                          </div>
                          <div className="flex justify-center gap-3 text-xs">
                            <div className="flex flex-col items-center">
                              <span className="text-green-600 dark:text-green-400 font-bold">{row.wins}</span>
                              <span className="text-muted-foreground">W</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-muted-foreground font-bold">{row.losses}</span>
                              <span className="text-muted-foreground">L</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className={`font-bold ${row.point_diff > 0 ? 'text-green-600 dark:text-green-400' : row.point_diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                              </span>
                              <span className="text-muted-foreground">Diff</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full Standings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Full Standings</CardTitle>
                <CardDescription>Based on completed matches</CardDescription>
              </CardHeader>
              <CardContent>
                {standings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No matches completed yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-semibold">#</th>
                          <th className="text-left py-3 px-2 font-semibold">Player</th>
                          <th className="text-center py-3 px-2 font-semibold">W</th>
                          <th className="text-center py-3 px-2 font-semibold">L</th>
                          <th className="text-center py-3 px-2 font-semibold hidden sm:table-cell">PF</th>
                          <th className="text-center py-3 px-2 font-semibold hidden sm:table-cell">PA</th>
                          <th className="text-center py-3 px-2 font-semibold">+/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.filter(s => !s.isRemoved).map((row, idx) => (
                          <tr key={row.player_id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <RankBadge rank={idx + 1} />
                            </td>
                            <td className="py-3 px-2 font-medium">{row.player_name}</td>
                            <td className="text-center py-3 px-2 font-semibold text-green-600 dark:text-green-400">{row.wins}</td>
                            <td className="text-center py-3 px-2 text-muted-foreground">{row.losses}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_for}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_against}</td>
                            <td className={`text-center py-3 px-2 font-semibold ${row.point_diff > 0 ? 'text-green-600 dark:text-green-400' : row.point_diff < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                              {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                            </td>
                          </tr>
                        ))}
                        
                        {/* DNF Section for removed players */}
                        {standings.filter(s => s.isRemoved).length > 0 && (
                          <>
                            <tr className="bg-muted/30">
                              <td colSpan={7} className="py-3 px-2 font-medium text-muted-foreground">
                                Did Not Finish (DNF)
                              </td>
                            </tr>
                            {standings.filter(s => s.isRemoved).map((row) => (
                              <tr key={row.player_id} className="border-b hover:bg-muted/30 opacity-60">
                                <td className="py-3 px-2">
                                  <Badge variant="outline" className="w-8 h-8 flex items-center justify-center bg-muted/50">
                                    —
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 font-medium text-muted-foreground">{row.player_name}</td>
                                <td className="text-center py-3 px-2 text-muted-foreground">{row.wins}</td>
                                <td className="text-center py-3 px-2 text-muted-foreground">{row.losses}</td>
                                <td className="text-center py-3 px-2 hidden sm:table-cell text-muted-foreground">{row.points_for}</td>
                                <td className="text-center py-3 px-2 hidden sm:table-cell text-muted-foreground">{row.points_against}</td>
                                <td className="text-center py-3 px-2 text-muted-foreground">
                                  {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
          </div>{/* /center column */}

          {/* RIGHT — roster summary, next steps, event details (desktop only) */}
          {isOrganizer && (
            <aside className="hidden lg:block">
              <RRRightSidebar
                playerCount={activeRoster.length}
                hasSchedule={hasSchedule}
                status={event.status}
                format={event.format}
                date={event.date}
                startTime={event.start_time}
                location={event.location}
                ratingEligible={event.rating_eligible}
                allowGuests={event.allow_guests}
                onAddPlayers={() => setPlayerManagementOpen(true)}
                onGenerateSchedule={handleGenerateSchedule}
                onEditEvent={handleToggleEditMode}
                onGoToPlayers={() => setActiveTab('players')}
              />
            </aside>
          )}
        </div>{/* /desktop grid */}
      </main>

      {/* One schedule-review surface for first generation and later rebuilds. */}
      <AlertDialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <AlertDialogContent className="max-h-[min(90dvh,760px)] overflow-y-auto sm:max-w-xl">
          <AlertDialogHeader>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
              Schedule review
            </div>
            <AlertDialogTitle className="text-[20px] font-extrabold tracking-[-0.01em]">
              {hasSchedule ? "Rebalance the adjustable rounds?" : "Generate this rotation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasSchedule
                ? repairFromRound > 1
                  ? `Rounds 1–${repairFromRound - 1} stay protected. From Round ${repairFromRound} forward, courts, rests, partners, and opponents adapt together.`
                  : "No rounds are locked yet. Courts, rests, partners, and opponents will all rebalance together."
                : "Review the projected court use, rests, game totals, and fairness before creating matchups."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScheduleImpactPreview
            playerCount={activeRoster.length}
            courtCount={event.num_courts}
            gamesPerPlayer={event.games_per_player || 3}
            currentRound={event.current_round}
            preserveCompleted={hasSchedule}
            title={hasSchedule ? "Rebuild impact" : "First rotation"}
            compact
            plan={currentSchedulePlan}
            getPlayerName={getImpactPlayerName}
            showImpactSummary={hasSchedule}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{hasSchedule ? "Keep current schedule" : "Not yet"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={runRegenerateSchedule}
              disabled={!canGenerate || currentSchedulePlan?.ok === false}
            >
              {hasSchedule ? "Apply rebuild" : "Generate schedule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this Round Robin?</AlertDialogTitle>
            <AlertDialogDescription>
              Pick how to handle the event. Both options remove it from
              your active list.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Two-mode picker — replaces the previous single-mode dialog
              that couldn't be toggled in place. Each option is a
              tappable card with copy + warning. */}
          <div className="grid grid-cols-1 gap-2 my-2">
            {/* VOID — soft cancel. Always available to the host. */}
            <button
              type="button"
              onClick={() => setDeleteMode('void')}
              className={cn(
                "text-left rounded-lg border-2 p-3 transition-all",
                deleteMode === 'void'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    deleteMode === 'void'
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Ban className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">Void event</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Keeps the record with a "Voided" badge. Matches stop
                    counting toward ratings. Reversible by an admin.
                  </div>
                </div>
              </div>
            </button>

            {/* DELETE — hard, irreversible. Disabled (not just warned)
                when the event has scores and the user is not an admin. */}
            <button
              type="button"
              onClick={() => setDeleteMode('hard')}
              disabled={hasScores && !isAdmin}
              className={cn(
                "text-left rounded-lg border-2 p-3 transition-all",
                deleteMode === 'hard'
                  ? "border-destructive bg-destructive/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30",
                hasScores && !isAdmin && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    deleteMode === 'hard'
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">Delete permanently</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {hasScores && !isAdmin
                      ? "Disabled — this event has saved scores. Void instead, or ask an admin to hard-delete."
                      : "Removes the schedule, players, and all records. Cannot be undone."}
                  </div>
                </div>
              </div>
            </button>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleteMode === 'hard' && hasScores && !isAdmin}
              className={deleteMode === 'hard' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleteMode === 'void' ? 'Void event' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {event && (
        <>
          <EditEventDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            event={event}
            onSave={handleSaveEventSettings}
            playerCount={activeRoster.length}
            onOpenSchedule={() => {
              setEditDialogOpen(false);
              setCourtsRoundsOpen(true);
            }}
          />
          
          <PlayerManagementDialog
            open={playerManagementOpen}
            onOpenChange={setPlayerManagementOpen}
            players={players}
            eventStatus={event.status}
            currentRound={event.current_round}
            totalRounds={event.num_rounds}
            hasSchedule={hasSchedule}
            firstAdjustableRound={repairFromRound}
            groupId={event.group_id}
            genderFilter={event.format === "male" ? "male" : event.format === "female" ? "female" : undefined}
            eventFormat={(event.format || "open") as EventFormat}
            ratingEligible={event.rating_eligible}
            onAddPlayers={handleAddPlayers}
            onMarkInactive={handleMarkInactive}
            onSubstitute={handleSubstitute}
          />

          {activeMatchPrompt && (
            <ActiveMatchResolutionDialog
              open={!!activeMatchPrompt}
              onOpenChange={(o) => {
                if (!o && !resolvingActiveMatch) setActiveMatchPrompt(null);
              }}
              participantName={activeMatchPrompt.participantName}
              courtNo={activeMatchPrompt.courtNo}
              isScored={activeMatchPrompt.isScored}
              team1Score={activeMatchPrompt.team1Score}
              team2Score={activeMatchPrompt.team2Score}
              loading={resolvingActiveMatch}
              onResolve={async (kind) => {
                setResolvingActiveMatch(true);
                try {
                  await activeMatchPrompt.run(kind);
                  setActiveMatchPrompt(null);
                } catch {
                  // The run() path already surfaced a specific toast; keep the
                  // dialog open so the host can pick a different resolution or
                  // cancel rather than losing their place.
                } finally {
                  setResolvingActiveMatch(false);
                }
              }}
            />
          )}

          <CourtsRoundsDialog
            open={courtsRoundsOpen}
            onOpenChange={setCourtsRoundsOpen}
            currentCourts={event.num_courts}
            currentGamesPerPlayer={event.games_per_player || 3}
            currentTotalRounds={event.num_rounds}
            currentRound={event.current_round}
            hasScores={hasScores}
            hasSchedule={hasSchedule}
            totalPlayers={activeRoster.length}
            estimatedPlayerCount={Math.max(4, activeRoster.length, event.max_players ?? 0)}
            onApply={handleApplyScheduleSettings}
            getImpactPlan={buildScheduleImpactPlan}
            getPlayerName={getImpactPlayerName}
          />

          <ScheduleEditorDialog
            open={scheduleEditorOpen}
            onOpenChange={setScheduleEditorOpen}
            schedule={schedule}
            currentRound={event.current_round}
            eventStatus={event.status}
            eventFormat={event.format}
            numCourts={event.num_courts}
            getPlayerName={getPlayerName}
            onRotatePartners={handleRotatePartners}
            onSwapOpponents={handleSwapOpponents}
            onMoveCourt={handleMoveCourt}
          />

          <ScoreManagementDialog
            open={scoreManagementOpen}
            onOpenChange={setScoreManagementOpen}
            schedule={schedule}
            isAdmin={isAdmin}
            ratingEligible={event.rating_eligible}
            getPlayerName={getPlayerName}
            onEditScore={handleEditMatchScore}
            onVoidMatch={handleVoidMatch}
            onDeleteMatch={handleDeleteMatch}
          />

          <AuditHistoryDialog
            open={auditHistoryOpen}
            onOpenChange={setAuditHistoryOpen}
            auditEntries={auditEntries}
          />

          {inviteGuest && (
            <GuestInviteDialog
              open={!!inviteGuest}
              onOpenChange={(o) => !o && setInviteGuest(null)}
              guestPlayerId={inviteGuest.id}
              guestDisplayName={inviteGuest.name}
              defaultEmail={inviteGuest.email}
            />
          )}



          <EditNotifications
            eventId={id || ""}
            userId={userId}
            isOrganizer={isOrganizer}
          />
        </>
      )}
      </div>

      {/* Sticky "Review & Submit Event" action bar — only shown to the host
          when every match across every round has a score and the event is
          still live. Mirrors the mockup's final-action surface. */}
      {isOrganizer && event.status === "live" && !event.voided && hasSchedule && (() => {
        const playableMatches = schedule.filter((m) => !m.is_bye);
        const allScored =
          playableMatches.length > 0 &&
          playableMatches.every(
            (m) => m.team1_score !== null && m.team2_score !== null,
          );
        if (!allScored) return null;
        return (
          <div className="fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2 pointer-events-none">
            <div className="container max-w-2xl mx-auto pointer-events-auto">
              <button
                type="button"
                onClick={handleCompleteEvent}
                className="w-full flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground px-4 py-3.5 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] hover:bg-primary/90 active:scale-[0.99] transition-all"
                aria-label="Review and submit event"
              >
                <div className="h-11 w-11 rounded-xl bg-primary-foreground/95 text-primary flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-base font-bold leading-tight">Review & Submit Event</div>
                  <div className="text-xs opacity-90 mt-0.5 truncate">
                    All rounds complete · Ready to submit
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 opacity-90" />
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


