import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { LiveIndicator } from '@/components/tournament/LiveIndicator';
import { AlertCircle, Trophy, Users, Link2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import logo from '@/assets/pulse-logo-new.png';

interface Team {
  id: string;
  team_name: string;
  division: {
    name: string;
    event: {
      name: string;
      public_view_enabled: boolean;
    };
  };
  player1: {
    display_name: string | null;
    full_name: string;
  } | null;
  player2: {
    display_name: string | null;
    full_name: string;
  } | null;
}

interface Match {
  id: string;
  match_number: number;
  status: string;
  team1_id: string;
  team2_id: string;
  team1_score: number | null;
  team2_score: number | null;
  completed_at: string | null;
  actual_duration_minutes: number | null;
  court: {
    court_name: string | null;
    court_number: number;
  } | null;
  opponent: {
    id: string;
    team_name: string;
  };
}

interface Standing {
  team_id: string;
  team_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
}

const TournamentTeamView = () => {
  const { eventId, teamId } = useParams();
  const { toast } = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [completedMatches, setCompletedMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = async () => {
    if (!teamId || !eventId) return;

    try {
      // Fetch team with division and event info
      const { data: teamData, error: teamError } = await supabase
        .from('tournaments_teams')
        .select(`
          id,
          team_name,
          division:tournaments_divisions!inner(
            name,
            event:tournaments_events!inner(
              name,
              public_view_enabled
            )
          ),
          player1:profiles!tournaments_teams_player1_id_fkey(display_name, full_name),
          player2:profiles!tournaments_teams_player2_id_fkey(display_name, full_name)
        `)
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      if (!teamData) throw new Error('Team not found');
      if (!teamData.division.event.public_view_enabled) {
        setError('This event is not publicly viewable');
        return;
      }

      setTeam(teamData);

      // Fetch all matches for this team and division
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournaments_matches')
        .select(`
          id,
          match_number,
          status,
          team1_id,
          team2_id,
          team1_score,
          team2_score,
          completed_at,
          actual_duration_minutes,
          division_id,
          court:tournaments_courts(court_name, court_number),
          team1:tournaments_teams!tournaments_matches_team1_id_fkey(id, team_name),
          team2:tournaments_teams!tournaments_matches_team2_id_fkey(id, team_name)
        `)
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
        .order('match_number');

      if (matchesError) throw matchesError;

      // Get division ID from first match
      const divisionId = matchesData?.[0]?.division_id;

      // Fetch all matches in division for standings
      if (divisionId) {
        const { data: allDivisionMatches } = await supabase
          .from('tournaments_matches')
          .select(`
            team1_id,
            team2_id,
            team1_score,
            team2_score,
            status,
            team1:tournaments_teams!tournaments_matches_team1_id_fkey(id, team_name),
            team2:tournaments_teams!tournaments_matches_team2_id_fkey(id, team_name)
          `)
          .eq('division_id', divisionId)
          .eq('status', 'completed');

        // Calculate standings
        const teamStats: Record<string, Standing> = {};
        (allDivisionMatches || []).forEach((match) => {
          if (!match.team1_score || !match.team2_score) return;

          const team1Won = match.team1_score > match.team2_score;

          // Team 1
          if (!teamStats[match.team1_id]) {
            teamStats[match.team1_id] = {
              team_id: match.team1_id,
              team_name: match.team1.team_name,
              wins: 0,
              losses: 0,
              points_for: 0,
              points_against: 0,
              point_diff: 0,
            };
          }
          teamStats[match.team1_id].wins += team1Won ? 1 : 0;
          teamStats[match.team1_id].losses += team1Won ? 0 : 1;
          teamStats[match.team1_id].points_for += match.team1_score;
          teamStats[match.team1_id].points_against += match.team2_score;

          // Team 2
          if (!teamStats[match.team2_id]) {
            teamStats[match.team2_id] = {
              team_id: match.team2_id,
              team_name: match.team2.team_name,
              wins: 0,
              losses: 0,
              points_for: 0,
              points_against: 0,
              point_diff: 0,
            };
          }
          teamStats[match.team2_id].wins += team1Won ? 0 : 1;
          teamStats[match.team2_id].losses += team1Won ? 1 : 0;
          teamStats[match.team2_id].points_for += match.team2_score;
          teamStats[match.team2_id].points_against += match.team1_score;
        });

        const calculatedStandings = Object.values(teamStats).map((team) => ({
          ...team,
          point_diff: team.points_for - team.points_against,
        }));

        calculatedStandings.sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.point_diff - a.point_diff;
        });

        setStandings(calculatedStandings);
      }

      // Process matches to determine opponent
      const processedMatches = (matchesData || []).map(match => {
        const isTeam1 = match.team1_id === teamId;
        return {
          ...match,
          opponent: isTeam1 ? match.team2 : match.team1
        };
      });

      // Split into upcoming and completed
      const upcoming = processedMatches.filter(m => m.status !== 'completed');
      const completed = processedMatches.filter(m => m.status === 'completed');

      setUpcomingMatches(upcoming);
      setCompletedMatches(completed);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching team data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [teamId, eventId]);

  useTournamentRealtime(
    eventId || '',
    () => fetchTeamData()
  );

  const getRecord = () => {
    let wins = 0;
    let losses = 0;

    completedMatches.forEach(match => {
      if (!match.team1_score || !match.team2_score) return;
      const isTeam1 = match.team1_id === teamId;
      const won = isTeam1 
        ? match.team1_score > match.team2_score
        : match.team2_score > match.team1_score;
      
      if (won) wins++;
      else losses++;
    });

    return { wins, losses };
  };

  const getMatchResult = (match: Match) => {
    if (!match.team1_score || !match.team2_score) return null;
    const isTeam1 = match.team1_id === teamId;
    const won = isTeam1 
      ? match.team1_score > match.team2_score
      : match.team2_score > match.team1_score;
    return won;
  };
  
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard",
    });
  };
  
  const getOpponentRecord = (opponentId: string) => {
    const opponentStats = standings.find(s => s.team_id === opponentId);
    if (!opponentStats) return null;
    return `${opponentStats.wins}-${opponentStats.losses}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading team info...</div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <h1 className="text-2xl font-bold">
                {error || 'Team not found'}
              </h1>
              <p className="text-muted-foreground">
                This team information is not available for viewing.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const record = getRecord();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={`/tournament/${eventId}/live`}>
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <LiveIndicator />
      
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">{team.team_name}</h1>
          <p className="text-lg text-muted-foreground">{team.division.name}</p>
          <p className="text-sm text-muted-foreground">{team.division.event.name}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-muted-foreground" />
                <span>{team.player1?.display_name || team.player1?.full_name || 'TBD'}</span>
                <span className="text-muted-foreground">&</span>
                <span>{team.player2?.display_name || team.player2?.full_name || 'TBD'}</span>
              </div>
              <div className="flex gap-3">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">Record</div>
                  <div className="text-2xl font-bold">
                    {record.wins} - {record.losses}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Link2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Division Standings */}
        {standings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Division Standings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 font-semibold">Rank</th>
                      <th className="text-left pb-2 font-semibold">Team</th>
                      <th className="text-center pb-2 font-semibold">W</th>
                      <th className="text-center pb-2 font-semibold">L</th>
                      <th className="text-center pb-2 font-semibold">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((standing, index) => (
                      <tr 
                        key={standing.team_id} 
                        className={`border-b ${standing.team_id === teamId ? 'bg-yellow-100 dark:bg-yellow-900/20 font-semibold' : ''}`}
                      >
                        <td className="py-2">{index + 1}</td>
                        <td className="py-2">{standing.team_name}</td>
                        <td className="py-2 text-center">{standing.wins}</td>
                        <td className="py-2 text-center">{standing.losses}</td>
                        <td className="py-2 text-center">
                          <span className={standing.point_diff > 0 ? 'text-green-600' : standing.point_diff < 0 ? 'text-red-600' : ''}>
                            {standing.point_diff > 0 ? '+' : ''}{standing.point_diff}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Upcoming Matches
              {upcomingMatches.length > 0 && (
                <Badge variant="secondary">{upcomingMatches.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length === 0 ? (
              <p className="text-muted-foreground">No upcoming matches</p>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((match, index) => {
                  const opponentRecord = getOpponentRecord(match.opponent.id);
                  const isNextMatch = index === 0;
                  
                  return (
                    <div 
                      key={match.id} 
                      className={`p-4 rounded-lg border ${isNextMatch ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">vs {match.opponent.team_name}</div>
                            {opponentRecord && (
                              <Badge variant="outline" className="text-xs">
                                {opponentRecord}
                              </Badge>
                            )}
                          </div>
                          {match.court && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {match.court.court_name || `Court ${match.court.court_number}`}
                            </div>
                          )}
                          {isNextMatch && (
                            <div className="text-sm text-primary font-semibold mt-1">
                              Next Match
                            </div>
                          )}
                        </div>
                        <Badge variant={match.status === 'in_progress' ? 'default' : 'outline'}>
                          {match.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Completed Matches
              {completedMatches.length > 0 && (
                <Badge variant="secondary">{completedMatches.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedMatches.length === 0 ? (
              <p className="text-muted-foreground">No completed matches yet</p>
            ) : (
              <div className="space-y-3">
                {completedMatches.map(match => {
                  const won = getMatchResult(match);
                  const isTeam1 = match.team1_id === teamId;
                  const ourScore = isTeam1 ? match.team1_score : match.team2_score;
                  const theirScore = isTeam1 ? match.team2_score : match.team1_score;

                  return (
                    <div key={match.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">vs {match.opponent.team_name}</div>
                        {won !== null && (
                          <Badge variant={won ? 'default' : 'destructive'}>
                            {won ? 'Win' : 'Loss'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-semibold text-lg text-foreground">
                          {ourScore} - {theirScore}
                        </span>
                        {match.actual_duration_minutes && (
                          <span>{match.actual_duration_minutes} min</span>
                        )}
                        {match.completed_at && (
                          <span>{new Date(match.completed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TournamentTeamView;
