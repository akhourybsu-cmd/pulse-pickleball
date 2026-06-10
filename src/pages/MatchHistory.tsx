import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, CheckCircle2, Flag, History, Plus, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { toLocaleDateStringEST } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const issueSchema = z.object({
  details: z.string().trim().max(500, "Details too long").optional(),
  matchId: z.string().uuid("Invalid match ID"),
  issueType: z.enum(['contest_result', 'wrong_court', 'wrong_opponent', 'didnt_play']),
});

interface Match {
  match_id: string;
  match_date: string;
  created_at: string;
  team1_score: number;
  team2_score: number;
  my_team: number;
  partner_name: string;
  partner_id: string;
  opponent1_name: string;
  opponent1_id: string;
  opponent2_name: string;
  opponent2_id: string;
  rating_change: number;
  rating_after: number;
  court_name: string;
  other_location: string | null;
  won: boolean;
  verified_by: string[];
  source?: string;
  round_no?: number;
  court_no?: number;
}

const MatchHistory = () => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerId = searchParams.get("player");
  const tabParam = searchParams.get("tab");
  const activeTab: "all" | "pending" | "verified" =
    tabParam === "pending" || tabParam === "verified" ? tabParam : "all";
  const setActiveTab = (next: "all" | "pending" | "verified") => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setSearchParams(params, { replace: true });
  };
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [issueDetails, setIssueDetails] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [matchToVerify, setMatchToVerify] = useState<string | null>(null);

  useEffect(() => {
    fetchMatchHistory();

    console.log('👀 Setting up realtime subscription for match verifications');
    
    // Subscribe to realtime updates for match verifications
    const channel = supabase
      .channel('match-verifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches'
        },
        (payload: any) => {
          console.log('🔔 Realtime verification update received:', payload);
          console.log('🔔 Updated match ID:', (payload.new as any).id);
          console.log('🔔 New verified_by:', (payload.new as any).verified_by);
          
          // Update local state when a match is verified
          if (payload.new && 'verified_by' in payload.new) {
            const newVerifiedBy = (payload.new as any).verified_by || [];
            const matchId = (payload.new as any).id;
            console.log('🔄 Updating local state for match', matchId, 'with verified_by:', newVerifiedBy);
            
            setMatches(prevMatches => {
              const updated = prevMatches.map(m => {
                if (m.match_id === matchId) {
                  console.log('✅ Found match to update:', m.match_id);
                  return { ...m, verified_by: newVerifiedBy };
                }
                return m;
              });
              console.log('📊 Updated matches state');
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  const fetchMatchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const playerIdToUse = playerId || user?.id;
    
    console.log('Fetching match history for player:', playerIdToUse);
    console.log('Current user ID:', user?.id);
    
    if (!playerIdToUse) {
      navigate("/auth");
      return;
    }

    setCurrentUserId(user?.id || null);

    // Fetch pending matches for current user
    if (user?.id && !playerId) {
      await fetchPendingMatches(user.id);
    }

    // Get player name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", playerIdToUse)
      .single();

    setPlayerName(profile?.display_name || profile?.full_name || "Player");

    // Get all approved matches for this player
    const { data: participantsData, error: fetchError } = await supabase
      .from("match_participants")
      .select(`
        match_id,
        team,
        rating_change,
        rating_after,
        matches!inner(
          id,
          match_date,
          created_at,
          team1_score,
          team2_score,
          status,
          court_id,
          other_location,
          verified_by,
          courts(name)
        )
      `)
      .eq("player_id", playerIdToUse)
      .eq("matches.status", "approved");

    console.log('Fetched participants data:', participantsData);
    console.log('Fetch error:', fetchError);

    if (!participantsData) {
      setLoading(false);
      return;
    }

    // Get details for each match
    const matchesWithDetails = await Promise.all(
      participantsData.map(async (p: any) => {
        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select(`
            player_id,
            team,
            profiles(full_name, display_name)
          `)
          .eq("match_id", p.match_id);

        const myTeam = p.team;
        const teammates = allParticipants?.filter(
          part => part.team === myTeam && part.player_id !== playerIdToUse
        );
        const opponents = allParticipants?.filter(part => part.team !== myTeam);

        const won = p.rating_change !== null && p.rating_change > 0;

        // Determine court name
        let courtName = "Unknown Court";
        let otherLocation = null;
        
        if (p.matches.other_location) {
          courtName = p.matches.other_location;
          otherLocation = p.matches.other_location;
        } else if (p.matches.courts?.name) {
          courtName = p.matches.courts.name;
        }

        const matchData = {
          match_id: p.match_id,
          match_date: p.matches.match_date,
          created_at: p.matches.created_at,
          team1_score: p.matches.team1_score,
          team2_score: p.matches.team2_score,
          my_team: myTeam,
          partner_name: teammates?.[0]?.profiles?.display_name || teammates?.[0]?.profiles?.full_name || "Unknown",
          partner_id: teammates?.[0]?.player_id || "",
          opponent1_name: opponents?.[0]?.profiles?.display_name || opponents?.[0]?.profiles?.full_name || "Unknown",
          opponent1_id: opponents?.[0]?.player_id || "",
          opponent2_name: opponents?.[1]?.profiles?.display_name || opponents?.[1]?.profiles?.full_name || "Unknown",
          opponent2_id: opponents?.[1]?.player_id || "",
          rating_change: p.rating_change ?? null,
          rating_after: p.rating_after ?? null,
          court_name: courtName,
          other_location: otherLocation,
          won,
          verified_by: p.matches.verified_by || [],
        };
        
        console.log('Match data for', p.match_id, ':', matchData);
        console.log('Verified by array:', p.matches.verified_by);
        
        return matchData;
      })
    );

    // Sort by match_date DESC, then created_at DESC, then match_id DESC
    matchesWithDetails.sort((a, b) => {
      if (a.match_date !== b.match_date) {
        return b.match_date.localeCompare(a.match_date);
      }
      if (a.created_at !== b.created_at) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.match_id.localeCompare(a.match_id);
    });

    setMatches(matchesWithDetails);
    setLoading(false);
  };

  const fetchPendingMatches = async (userId: string) => {
    const { data: participantsData } = await supabase
      .from("match_participants")
      .select(`
        match_id,
        team,
        matches!inner(
          id,
          match_date,
          created_at,
          team1_score,
          team2_score,
          status,
          court_id,
          courts(name),
          other_location,
          source,
          court_no,
          round_no
        )
      `)
      .eq("player_id", userId)
      .eq("matches.status", "pending");

    if (!participantsData) {
      setPendingMatches([]);
      return;
    }

    const pendingMatchesWithDetails = await Promise.all(
      participantsData.map(async (p: any) => {
        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select(`
            player_id,
            team,
            profiles(full_name, display_name)
          `)
          .eq("match_id", p.match_id);

        const { data: approvals } = await supabase
          .from("match_approvals")
          .select("player_id, approved")
          .eq("match_id", p.match_id);

        const myTeam = p.team;
        const teammates = allParticipants?.filter(
          part => part.team === myTeam && part.player_id !== userId
        );
        const opponents = allParticipants?.filter(part => part.team !== myTeam);
        const verifiedBy = approvals?.filter(a => a.approved === true).map(a => a.player_id) || [];
        
        let courtName = "Unknown Court";
        let otherLocation = null;
        if (p.matches.other_location) {
          courtName = p.matches.other_location;
          otherLocation = p.matches.other_location;
        } else if (p.matches.courts?.name) {
          courtName = p.matches.courts.name;
        }

        return {
          match_id: p.match_id,
          match_date: p.matches.match_date,
          created_at: p.matches.created_at,
          team1_score: p.matches.team1_score,
          team2_score: p.matches.team2_score,
          my_team: myTeam,
          partner_name: teammates?.[0]?.profiles?.display_name || teammates?.[0]?.profiles?.full_name || "Unknown",
          partner_id: teammates?.[0]?.player_id || "",
          opponent1_name: opponents?.[0]?.profiles?.display_name || opponents?.[0]?.profiles?.full_name || "Unknown",
          opponent1_id: opponents?.[0]?.player_id || "",
          opponent2_name: opponents?.[1]?.profiles?.display_name || opponents?.[1]?.profiles?.full_name || "Unknown",
          opponent2_id: opponents?.[1]?.player_id || "",
          rating_change: 0,
          rating_after: 0,
          court_name: courtName,
          other_location: otherLocation,
          won: p.team === 1 ? p.matches.team1_score > p.matches.team2_score : p.matches.team2_score > p.matches.team1_score,
          verified_by: verifiedBy,
          source: p.matches.source,
          round_no: p.matches.round_no,
          court_no: p.matches.court_no,
        };
      })
    );

    pendingMatchesWithDetails.sort((a, b) => {
      if (a.match_date !== b.match_date) {
        return b.match_date.localeCompare(a.match_date);
      }
      return b.created_at.localeCompare(a.created_at);
    });

    setPendingMatches(pendingMatchesWithDetails);
  };

  const handleVerifyPendingMatch = async (matchId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from("match_approvals")
        .update({
          approved: true,
          approved_at: new Date().toISOString()
        })
        .eq("match_id", matchId)
        .eq("player_id", currentUserId);

      if (error) throw error;

      toast.success("Match verified! Will auto-approve when 2+ players verify.");
      
      // Refresh both lists
      fetchMatchHistory();
    } catch (error: any) {
      toast.error(error.message || "Failed to verify match");
    }
  };

  const handleReportIssue = async (issueType: string) => {
    if (!selectedMatchId || !currentUserId) return;

    try {
      const validationResult = issueSchema.safeParse({
        details: issueDetails,
        matchId: selectedMatchId,
        issueType,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      const { error } = await supabase
        .from("match_issues")
        .insert({
          match_id: selectedMatchId,
          reported_by: currentUserId,
          issue_type: issueType,
          details: issueDetails || null,
        });

      if (error) throw error;

      toast.success("Issue reported successfully. Admins have been notified.");
      setReportSheetOpen(false);
      setIssueDetails("");
      setSelectedMatchId(null);
      setSelectedIssueType(null);
    } catch (error) {
      console.error("Error reporting issue:", error);
      toast.error("Failed to report issue");
    }
  };

  const handleVerifyMatch = async () => {
    if (!currentUserId || !matchToVerify) {
      console.error('Missing currentUserId or matchToVerify', { currentUserId, matchToVerify });
      return;
    }

    const match = matches.find(m => m.match_id === matchToVerify);
    if (!match) {
      console.error('Match not found:', matchToVerify);
      return;
    }

    console.log('Current match verified_by:', match.verified_by);
    console.log('Current user ID:', currentUserId);

    // Don't add if already verified
    if (match.verified_by.includes(currentUserId)) {
      toast.info("You have already verified this match");
      setVerifyDialogOpen(false);
      setMatchToVerify(null);
      return;
    }

    try {
      // Use RPC function to safely append and dedupe
      const { data, error } = await supabase.rpc('verify_match', { 
        p_match_id: matchToVerify 
      });

      console.log('RPC response:', { data, error });

      if (error) throw error;

      // Update local state with server response
      if (data?.verified_by) {
        setMatches(prevMatches => prevMatches.map(m => 
          m.match_id === matchToVerify 
            ? { ...m, verified_by: data.verified_by }
            : m
        ));
      }

      console.log('✅ Match verified successfully');
      toast.success("Match verified");
      setVerifyDialogOpen(false);
      setMatchToVerify(null);
    } catch (error: any) {
      console.error("❌ Error verifying match:", error);
      toast.error(error?.message || "Failed to verify match");
    }
  };

  const getVerificationStatus = (match: Match) => {
    const allPlayerIds = [
      playerId || currentUserId,
      match.partner_id,
      match.opponent1_id,
      match.opponent2_id,
    ].filter(id => id && id.trim() !== "");

    const verifiedCount = match.verified_by.length;
    const totalPlayers = allPlayerIds.length;
    const isCurrentUserVerified = currentUserId ? match.verified_by.includes(currentUserId) : false;

    return { verifiedCount, totalPlayers, isCurrentUserVerified };
  };

  if (loading) {
    // Card-shaped skeleton matches the verified-card layout so the page doesn't
    // visually jump when matches arrive.
    return (
      <div className="min-h-screen bg-[hsl(var(--page-bg))]">
        <div className="border-b bg-gradient-to-b from-primary/10 via-background to-background">
          <div className="container mx-auto px-4 py-5 md:py-6 flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-28 flex-shrink-0" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      {/* PlayerShell now owns the top nav (logo + theme + notifications +
          avatar + sign-out) across every player tab. Matches no longer
          renders its own inline nav strip. */}

      {/* Page header — compact, primary CTA in the corner */}
      <div className="border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto px-4 py-5 md:py-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <History className="w-5 h-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {playerId ? `${playerName}'s Matches` : 'Matches'}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {playerId
                ? `Review ${playerName}'s pickleball results.`
                : 'Track your submitted, pending, and verified pickleball results.'}
            </p>
          </div>
          {!playerId && (
            <Button
              size="sm"
              onClick={() => navigate('/player/matches/new')}
              className="gap-1.5 flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Record Match</span>
              <span className="sm:hidden">Record</span>
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Tabs — only shown when viewing your own matches (not another player's).
            Render even when both lists are empty so the player can switch tabs
            and see the per-tab empty states. */}
        {!playerId && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "pending" | "verified")}>
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Pending{pendingMatches.length > 0 && ` (${pendingMatches.length})`}
              </TabsTrigger>
              <TabsTrigger value="verified">
                Verified{matches.length > 0 && ` (${matches.length})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Empty state for the Pending tab when there's nothing pending */}
        {!playerId && activeTab === "pending" && pendingMatches.length === 0 && (
          <Card className="rounded-2xl border-2 border-border shadow-lg">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
              <p className="font-semibold text-lg mb-1">All caught up</p>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                No matches awaiting your verification. Recorded another game?
              </p>
              <Button size="sm" onClick={() => navigate('/player/matches/new')}>
                <Plus className="w-4 h-4 mr-1.5" />
                Record another match
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending Matches Section — grouped so the player knows exactly who
            is blocking what. Order is intentional: "Needs your confirmation"
            first because that's the only group the player can act on. */}
        {!playerId && pendingMatches.length > 0 && (activeTab === "all" || activeTab === "pending") && (() => {
          // Split pending into two intent-driven buckets using existing
          // verified_by data (sourced from match_approvals at fetch time).
          const needsMyConfirmation = pendingMatches.filter(
            (m) => !(currentUserId && m.verified_by.includes(currentUserId))
          );
          const waitingOnOthers = pendingMatches.filter(
            (m) => currentUserId && m.verified_by.includes(currentUserId)
          );

          const renderPendingCard = (match: Match, index: number, sectionKey: string) => {
            const verificationCount = match.verified_by.length;
            const hasVerified = currentUserId ? match.verified_by.includes(currentUserId) : false;
            // Total players that *could* verify — current user + partner + 2 opponents
            // (partner_id is empty for singles). Filter out empty IDs.
            const totalApprovers = [
              currentUserId,
              match.partner_id,
              match.opponent1_id,
              match.opponent2_id,
            ].filter((id) => id && id.trim() !== '').length;

            return (
              <motion.div
                key={`${sectionKey}-${match.match_id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-semibold">
                          {toLocaleDateStringEST(match.match_date)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {match.court_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        {verificationCount}/{totalApprovers || 4} confirmed
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-center">
                        <p className="font-semibold text-sm mb-1">Your Team</p>
                        <p className="text-xs text-muted-foreground">{playerName}</p>
                        <p className="text-xs text-muted-foreground">{match.partner_name}</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {match.my_team === 1 ? match.team1_score : match.team2_score}
                          <span className="mx-2 text-muted-foreground">-</span>
                          {match.my_team === 1 ? match.team2_score : match.team1_score}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-sm mb-1">Opponents</p>
                        <p className="text-xs text-muted-foreground">{match.opponent1_name}</p>
                        <p className="text-xs text-muted-foreground">{match.opponent2_name}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t">
                      {hasVerified ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>You confirmed this — waiting on other players</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleVerifyPendingMatch(match.match_id)}
                          className="w-full"
                          variant="default"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm Result
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          };

          return (
            <div className="space-y-6">
              {/* Section 1: action required */}
              {needsMyConfirmation.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl md:text-2xl font-bold">Needs your confirmation</h2>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                      {needsMyConfirmation.length}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Tap <span className="font-medium text-foreground">Confirm Result</span> if the score looks right.
                    Once enough players confirm, the match is verified and saved to your PULSE history.
                  </p>
                  {needsMyConfirmation.map((match, i) => renderPendingCard(match, i, 'needs'))}
                </div>
              )}

              {/* Section 2: already confirmed by me */}
              {waitingOnOthers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-xl md:text-2xl font-bold">Waiting on other players</h2>
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                      {waitingOnOthers.length}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    You've already confirmed these. They'll move to your verified history once enough players confirm.
                  </p>
                  {waitingOnOthers.map((match, i) => renderPendingCard(match, i, 'waiting'))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Divider between pending and approved (only on the "all" tab) */}
        {!playerId && pendingMatches.length > 0 && matches.length > 0 && activeTab === "all" && (
          <div className="flex items-center gap-3 mb-4 mt-8">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-bold">Verified Match History</h2>
          </div>
        )}

        {/* Per-tab empty states (only when viewing your own matches).
            Each tab gets honest copy + a useful CTA — no blank screens. */}
        {!playerId && activeTab === "all" && matches.length === 0 && pendingMatches.length === 0 && (
          <Card className="rounded-2xl border-2 border-border shadow-lg">
            <CardContent className="p-8 text-center">
              <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-semibold text-lg mb-1">No matches yet</p>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                Record your first match to start building your PULSE history.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                <Button size="sm" onClick={() => navigate('/player/matches/new')}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Record your first match
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/player/play')}>
                  Find play
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!playerId && activeTab === "verified" && matches.length === 0 && (
          <Card className="rounded-2xl border-2 border-border shadow-lg">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-semibold text-lg mb-1">No verified matches yet</p>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                Verified matches will appear here once players confirm results.
              </p>
              <Button size="sm" onClick={() => navigate('/player/matches/new')}>
                <Plus className="w-4 h-4 mr-1.5" />
                Record Match
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Approved Matches Section */}
        {!playerId && activeTab === "pending" ? null : matches.length === 0 ? null : (
          <div className="space-y-4">
            {matches.map((match, index) => {
              const { verifiedCount, totalPlayers, isCurrentUserVerified } = getVerificationStatus(match);
              
              return (
                <motion.div
                  key={match.match_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                >
                  <Card className="rounded-2xl border-2 border-border shadow-lg hover:shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(169,220,61,0.15)] transition-all duration-300 bg-card">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{match.court_name}</CardTitle>
                        {match.source === 'round_robin' && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Round Robin • R{match.round_no} Court {match.court_no}
                          </Badge>
                        )}
                        {match.other_location && (
                          <p className="text-xs text-muted-foreground italic">
                            Not an official community court
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {toLocaleDateStringEST(match.match_date)}
                        </p>
                      </div>
                      <Badge variant={match.won ? "default" : "destructive"}>
                        {match.won ? "Won" : "Lost"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div>
                        <p className="text-sm font-semibold">Your Team</p>
                        <p className={`text-sm flex items-center gap-1 ${
                          match.verified_by.includes(playerId || currentUserId || '') 
                            ? 'text-green-600 dark:text-green-500' 
                            : 'text-red-600 dark:text-red-500'
                        }`}>
                          {match.verified_by.includes(playerId || currentUserId || '') ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {playerName}
                        </p>
                        <p className={`text-sm flex items-center gap-1 ${
                          match.verified_by.includes(match.partner_id) 
                            ? 'text-green-600 dark:text-green-500' 
                            : 'text-red-600 dark:text-red-500'
                        }`}>
                          {match.verified_by.includes(match.partner_id) ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {match.partner_name}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          {match.my_team === 1 ? match.team1_score : match.team2_score}
                          {" - "}
                          {match.my_team === 1 ? match.team2_score : match.team1_score}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">Opponents</p>
                        <p className={`text-sm flex items-center justify-end gap-1 ${
                          match.verified_by.includes(match.opponent1_id) 
                            ? 'text-green-600 dark:text-green-500' 
                            : 'text-red-600 dark:text-red-500'
                        }`}>
                          {match.verified_by.includes(match.opponent1_id) ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {match.opponent1_name}
                        </p>
                        <p className={`text-sm flex items-center justify-end gap-1 ${
                          match.verified_by.includes(match.opponent2_id) 
                            ? 'text-green-600 dark:text-green-500' 
                            : 'text-red-600 dark:text-red-500'
                        }`}>
                          {match.verified_by.includes(match.opponent2_id) ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {match.opponent2_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between pt-2 text-sm border-t">
                      <span>Rating Change:</span>
                      <span className={match.rating_change && match.rating_change > 0 ? "text-green-600" : "text-red-600"}>
                        {match.rating_change !== null ? (
                          <>
                            {match.rating_change > 0 ? "+" : ""}
                            {match.rating_change.toFixed(3)}
                          </>
                        ) : (
                          "N/A"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Rating After:</span>
                      <span className="font-semibold">
                        {match.rating_after !== null ? match.rating_after.toFixed(2) : "N/A"}
                      </span>
                    </div>
                    <div className="pt-2 border-t flex gap-2 items-center justify-between">
                      {!isCurrentUserVerified ? (
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMatchToVerify(match.match_id);
                            setVerifyDialogOpen(true);
                          }}
                          className="flex-1"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Verify Match
                          <span className="ml-2 text-xs">
                            ({verifiedCount}/{totalPlayers})
                          </span>
                        </Button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-500">
                          <CheckCircle2 className="w-4 h-4" />
                          Verified ({verifiedCount}/{totalPlayers})
                        </div>
                      )}
                      {!isCurrentUserVerified && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedMatchId(match.match_id);
                            setReportSheetOpen(true);
                          }}
                          className="flex-shrink-0"
                        >
                          <Flag className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={reportSheetOpen} onOpenChange={setReportSheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Report a Problem</SheetTitle>
            <SheetDescription>
              Select the issue type and provide details
            </SheetDescription>
          </SheetHeader>
          
          {!selectedIssueType ? (
            <div className="space-y-2 mt-4">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setSelectedIssueType('wrong_court')}
              >
                <Flag className="w-4 h-4 mr-2" />
                Wrong Court Entered
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setSelectedIssueType('wrong_opponent')}
              >
                <Flag className="w-4 h-4 mr-2" />
                Wrong Opponent Entered
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setSelectedIssueType('didnt_play')}
              >
                <Flag className="w-4 h-4 mr-2" />
                I didn't play this match
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <Textarea
                placeholder="Add details... (optional)"
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedIssueType(null);
                    setIssueDetails("");
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={() => selectedIssueType && handleReportIssue(selectedIssueType)}
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify this match?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to verify this score? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVerifyMatch}>Verify</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default MatchHistory;