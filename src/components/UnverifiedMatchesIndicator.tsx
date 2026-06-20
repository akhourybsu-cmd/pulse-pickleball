import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface UnverifiedMatch {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  opponent_names: string[];
}

export function UnverifiedMatchesIndicator() {
  const [unverifiedMatches, setUnverifiedMatches] = useState<UnverifiedMatch[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnverifiedMatches = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Get matches where user participated but hasn't verified
      const { data: participantMatches, error: participantError } = await supabase
        .from('match_participants')
        .select(`
          match_id,
          matches!inner(
            id,
            match_date,
            team1_score,
            team2_score,
            verified_by,
            status
          )
        `)
        .eq('player_id', user.id);

      if (participantError) {
        console.error('Error fetching unverified matches:', participantError);
        return;
      }

      // Filter matches where user hasn't verified and match is not pending
      const unverified = participantMatches
        ?.filter((p: any) => {
          const match = p.matches;
          return match.status !== 'pending' && 
                 match.verified_by && 
                 !match.verified_by.includes(user.id);
        })
        .map((p: any) => ({
          match_id: p.match_id,
          match_date: p.matches.match_date,
          team1_score: p.matches.team1_score,
          team2_score: p.matches.team2_score,
          opponent_names: []
        })) || [];

      setUnverifiedMatches(unverified);
    };

    fetchUnverifiedMatches();

    // Set up real-time subscription for match updates
    const channel = supabase
      .channel('unverified-matches-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches'
        },
        () => {
          fetchUnverifiedMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleMatchClick = () => {
    navigate('/match/history');
  };

  if (!unverifiedMatches.length) {
    return null;
  }

  if (unverifiedMatches.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleMatchClick}
        className="relative animate-pulse border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        Verify Match
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
      </Button>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative animate-pulse border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          {unverifiedMatches.length} Matches to Verify
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Matches Awaiting Verification</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {unverifiedMatches.map((match) => (
            <Card
              key={match.match_id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={handleMatchClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {new Date(match.match_date).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Needs verification
                  </span>
                </div>
                <div className="text-lg font-bold">
                  {match.team1_score} - {match.team2_score}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
