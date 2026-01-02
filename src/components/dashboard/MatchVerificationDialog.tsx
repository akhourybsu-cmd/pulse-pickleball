import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, MapPin, Users, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MatchVerificationDialogProps {
  matchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (matchId: string) => void;
}

interface MatchDetails {
  id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  other_location: string | null;
  court?: { name: string } | null;
}

interface Participant {
  player_id: string | null;
  team: number;
  profile?: { full_name: string | null; display_name: string | null } | null;
  guest?: { display_name: string } | null;
}

export const MatchVerificationDialog = ({
  matchId,
  open,
  onOpenChange,
  onVerified,
}: MatchVerificationDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !open) {
      setLoading(true);
      setMatch(null);
      setParticipants([]);
      setError(null);
      setVerified(false);
      return;
    }

    const fetchMatchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch match details
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select(`
            id,
            match_date,
            team1_score,
            team2_score,
            other_location,
            court:courts(name)
          `)
          .eq("id", matchId)
          .maybeSingle();

        if (matchError) throw matchError;
        if (!matchData) {
          setError("Match not found");
          setLoading(false);
          return;
        }

        setMatch(matchData as MatchDetails);

        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("match_participants")
          .select(`
            player_id,
            team,
            guest_player_id,
            profile:profiles(full_name, display_name),
            guest:guest_match_players(display_name)
          `)
          .eq("match_id", matchId);

        if (participantsError) throw participantsError;

        setParticipants(participantsData as Participant[]);
      } catch (err) {
        console.error("Error fetching match details:", err);
        setError("Failed to load match details");
      } finally {
        setLoading(false);
      }
    };

    fetchMatchDetails();
  }, [matchId, open]);

  const handleVerify = async () => {
    if (!matchId) return;

    setVerifying(true);
    try {
      const { error: verifyError } = await supabase.rpc("verify_match", {
        p_match_id: matchId,
      });

      if (verifyError) throw verifyError;

      setVerified(true);
      toast({
        title: "Match verified!",
        description: "The match result has been confirmed.",
      });

      // Wait for animation then close
      setTimeout(() => {
        onVerified(matchId);
        onOpenChange(false);
      }, 1200);
    } catch (err) {
      console.error("Error verifying match:", err);
      toast({
        title: "Verification failed",
        description: "Please try again or report an issue.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const team1Players = participants.filter((p) => p.team === 1);
  const team2Players = participants.filter((p) => p.team === 2);

  const getPlayerName = (p: Participant) => {
    if (p.profile) {
      return p.profile.display_name || p.profile.full_name || "Unknown";
    }
    if (p.guest) {
      return p.guest.display_name;
    }
    return "Unknown Player";
  };

  const locationName = match?.court?.name || match?.other_location || "Unknown Location";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Verify Match Result</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-3">Loading match details...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm text-destructive mt-3">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </motion.div>
          ) : verified ? (
            <motion.div
              key="verified"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle2 className="w-16 h-16 text-primary" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg font-medium mt-4"
              >
                Match Verified!
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Date */}
              {match && (
                <p className="text-sm text-muted-foreground text-center">
                  {format(new Date(match.match_date), "EEEE, MMMM d, yyyy")}
                </p>
              )}

              {/* Score Display */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-center gap-4"
              >
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary">
                    {match?.team1_score ?? "-"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Team 1</p>
                </div>
                <div className="text-2xl text-muted-foreground font-light">—</div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-foreground">
                    {match?.team2_score ?? "-"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Team 2</p>
                </div>
              </motion.div>

              {/* Teams */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 gap-4"
              >
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-primary">Team 1</span>
                  </div>
                  <div className="space-y-1">
                    {team1Players.map((p, idx) => (
                      <p key={idx} className="text-sm text-foreground truncate">
                        {getPlayerName(p)}
                      </p>
                    ))}
                    {team1Players.length === 0 && (
                      <p className="text-sm text-muted-foreground">No players</p>
                    )}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Team 2</span>
                  </div>
                  <div className="space-y-1">
                    {team2Players.map((p, idx) => (
                      <p key={idx} className="text-sm text-foreground truncate">
                        {getPlayerName(p)}
                      </p>
                    ))}
                    {team2Players.length === 0 && (
                      <p className="text-sm text-muted-foreground">No players</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Location */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <MapPin className="w-4 h-4" />
                <span>{locationName}</span>
              </motion.div>

              {/* Verify Button */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="w-full h-12 text-base"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Verify Match
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
