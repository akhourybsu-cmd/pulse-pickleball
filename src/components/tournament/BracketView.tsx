import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface Team {
  id: string;
  team_name: string;
}

interface Match {
  id: string;
  round_number: number;
  match_number: number;
  team1_id: string;
  team2_id: string;
  team1_score?: number;
  team2_score?: number;
  status: string;
  team1?: Team;
  team2?: Team;
}

interface BracketViewProps {
  matches: Match[];
  format: 'single_elimination' | 'double_elimination';
  onMatchClick: (match: Match) => void;
}

export const BracketView = ({ matches, format, onMatchClick }: BracketViewProps) => {
  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);
  
  const getMatchesByRound = (roundNumber: number) => {
    return matches
      .filter(m => m.round_number === roundNumber)
      .sort((a, b) => a.match_number - b.match_number);
  };

  const getWinner = (match: Match) => {
    if (match.status !== 'completed') return null;
    if ((match.team1_score || 0) > (match.team2_score || 0)) {
      return { id: match.team1_id, name: match.team1?.team_name };
    }
    return { id: match.team2_id, name: match.team2?.team_name };
  };

  const getRoundLabel = (roundNumber: number) => {
    const totalRounds = rounds.length;
    const roundsFromEnd = totalRounds - roundNumber;
    
    if (roundsFromEnd === 0) return 'Finals';
    if (roundsFromEnd === 1) return 'Semi-Finals';
    if (roundsFromEnd === 2) return 'Quarter-Finals';
    return `Round ${roundNumber}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">
          {format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination'} Bracket
        </h3>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-8 min-w-max pb-4">
          {rounds.map(roundNumber => {
            const roundMatches = getMatchesByRound(roundNumber);
            return (
              <div key={roundNumber} className="space-y-4 min-w-[280px]">
                <div className="text-center">
                  <Badge variant="outline" className="font-semibold">
                    {getRoundLabel(roundNumber)}
                  </Badge>
                </div>
                
                <div className="space-y-6">
                  {roundMatches.map(match => {
                    const winner = getWinner(match);
                    return (
                      <Card
                        key={match.id}
                        className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => onMatchClick(match)}
                      >
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground mb-2">
                            Match #{match.match_number}
                          </div>
                          
                          <div className={`flex justify-between items-center p-2 rounded ${
                            winner?.id === match.team1_id ? 'bg-primary/10 font-semibold' : ''
                          }`}>
                            <span className="text-sm">
                              {match.team1?.team_name || 'TBD'}
                            </span>
                            {match.team1_score !== null && match.team1_score !== undefined && (
                              <span className="font-mono font-bold">{match.team1_score}</span>
                            )}
                          </div>

                          <div className={`flex justify-between items-center p-2 rounded ${
                            winner?.id === match.team2_id ? 'bg-primary/10 font-semibold' : ''
                          }`}>
                            <span className="text-sm">
                              {match.team2?.team_name || 'TBD'}
                            </span>
                            {match.team2_score !== null && match.team2_score !== undefined && (
                              <span className="font-mono font-bold">{match.team2_score}</span>
                            )}
                          </div>

                          <div className="text-xs text-center text-muted-foreground mt-2">
                            {match.status === 'completed' && '✓ Complete'}
                            {match.status === 'in_progress' && '▶ In Progress'}
                            {match.status === 'scheduled' && 'Scheduled'}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
