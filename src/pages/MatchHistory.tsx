import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, CheckCircle2, Flag } from "lucide-react";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

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
}

const MatchHistory = () => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerId = searchParams.get("player");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [issueDetails, setIssueDetails] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [matchToVerify, setMatchToVerify] = useState<string | null>(null);

  useEffect(() => {
    fetchMatchHistory();

    // Subscribe to realtime updates for match verifications
    const channel = supabase
      .channel('match-verifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'verified_by=not.is.null'
        },
        (payload: any) => {
          console.log('Realtime verification update:', payload);
          // Update local state when a match is verified
          if (payload.new && 'verified_by' in payload.new) {
            setMatches(prevMatches => 
              prevMatches.map(m => 
                m.match_id === (payload.new as any).id 
                  ? { ...m, verified_by: (payload.new as any).verified_by || [] }
                  : m
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  const fetchMatchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const playerIdToUse = playerId || user?.id;
    
    if (!playerIdToUse) {
      navigate("/auth");
      return;
    }

    setCurrentUserId(user?.id || null);

    // Get player name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", playerIdToUse)
      .single();

    setPlayerName(profile?.display_name || profile?.full_name || "Player");

    // Get all approved matches for this player
    const { data: participantsData } = await supabase
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
          rating_change: p.rating_change ?? null,
          rating_after: p.rating_after ?? null,
          court_name: courtName,
          other_location: otherLocation,
          won,
          verified_by: p.matches.verified_by || [],
        };
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
    if (!currentUserId || !matchToVerify) return;

    const match = matches.find(m => m.match_id === matchToVerify);
    if (!match) return;

    // Don't add if already verified
    if (match.verified_by.includes(currentUserId)) {
      toast.info("You have already verified this match");
      setVerifyDialogOpen(false);
      setMatchToVerify(null);
      return;
    }

    const newVerifiedBy = [...match.verified_by, currentUserId];

    try {
      const { error } = await supabase
        .from("matches")
        .update({ verified_by: newVerifiedBy })
        .eq("id", matchToVerify);

      if (error) throw error;

      // Optimistically update local state
      setMatches(prevMatches => prevMatches.map(m => 
        m.match_id === matchToVerify 
          ? { ...m, verified_by: newVerifiedBy }
          : m
      ));

      toast.success("Match verified");
      setVerifyDialogOpen(false);
      setMatchToVerify(null);
    } catch (error) {
      console.error("Error verifying match:", error);
      toast.error("Failed to verify match");
    }
  };

  const getVerificationStatus = (match: Match) => {
    const allPlayerIds = [
      currentUserId,
      match.partner_id,
      match.opponent1_id,
      match.opponent2_id,
    ].filter(id => id);

    const verifiedCount = match.verified_by.length;
    const totalPlayers = allPlayerIds.length;
    const isCurrentUserVerified = currentUserId ? match.verified_by.includes(currentUserId) : false;

    return { verifiedCount, totalPlayers, isCurrentUserVerified };
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Match History - {playerName}</h1>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No match history yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const { verifiedCount, totalPlayers, isCurrentUserVerified } = getVerificationStatus(match);
              
              return (
                <Card key={match.match_id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{match.court_name}</CardTitle>
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