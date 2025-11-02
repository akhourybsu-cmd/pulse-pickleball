import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { LiveIndicator } from '@/components/tournament/LiveIndicator';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ThemeToggle } from '@/components/ThemeToggle';
import logo from '@/assets/pulse-logo-new.png';

interface TournamentEvent {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  public_view_enabled: boolean;
}

interface Division {
  id: string;
  name: string;
  status: string;
}

interface Match {
  id: string;
  match_number: number;
  status: string;
  team1_score: number | null;
  team2_score: number | null;
  division_id: string;
  scheduled_time: string | null;
  court: {
    court_name: string | null;
    court_number: number;
  } | null;
  team1: {
    team_name: string;
  };
  team2: {
    team_name: string;
  };
}

interface Standing {
  team_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
}

const TournamentLiveView = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [matchesByDivision, setMatchesByDivision] = useState<Record<string, Match[]>>({});
  const [standingsByDivision, setStandingsByDivision] = useState<Record<string, Standing[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchEventData = async () => {
    if (!eventId) return;

    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('tournaments_events')
        .select('id, name, location, start_date, end_date, public_view_enabled')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      if (!eventData) throw new Error('Event not found');
      if (!eventData.public_view_enabled) {
        setError('This event is not publicly viewable');
        return;
      }

      setEvent(eventData);

      // Fetch divisions
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('tournaments_divisions')
        .select('id, name, status')
        .eq('event_id', eventId)
        .order('name');

      if (divisionsError) throw divisionsError;
      setDivisions(divisionsData || []);

      // Fetch matches for all divisions
      if (divisionsData && divisionsData.length > 0) {
        const { data: matchesData, error: matchesError } = await supabase
          .from('tournaments_matches')
          .select(`
            id,
            match_number,
            status,
            team1_score,
            team2_score,
            division_id,
            scheduled_time,
            court:tournaments_courts(court_name, court_number),
            team1:tournaments_teams!tournaments_matches_team1_id_fkey(team_name),
            team2:tournaments_teams!tournaments_matches_team2_id_fkey(team_name)
          `)
          .in('division_id', divisionsData.map(d => d.id))
          .order('match_number');

        if (matchesError) throw matchesError;

        // Group matches by division
        const grouped: Record<string, Match[]> = {};
        divisionsData.forEach(div => {
          grouped[div.id] = (matchesData || []).filter(m => m.division_id === div.id);
        });
        setMatchesByDivision(grouped);

        // Calculate standings for each division
        const standings: Record<string, Standing[]> = {};
        divisionsData.forEach(div => {
          standings[div.id] = calculateStandings(grouped[div.id] || []);
        });
        setStandingsByDivision(standings);
      }

      setLoading(false);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching tournament data:', err);
      setError(err.message);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };
  
  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchEventData();
  };

  const calculateStandings = (matches: Match[]): Standing[] => {
    const completedMatches = matches.filter(m => m.status === 'completed');
    const teamStats: Record<string, Standing> = {};

    completedMatches.forEach(match => {
      if (!match.team1_score || !match.team2_score) return;

      const team1Won = match.team1_score > match.team2_score;

      // Team 1
      if (!teamStats[match.team1.team_name]) {
        teamStats[match.team1.team_name] = {
          team_name: match.team1.team_name,
          wins: 0,
          losses: 0,
          points_for: 0,
          points_against: 0,
          point_diff: 0
        };
      }
      teamStats[match.team1.team_name].wins += team1Won ? 1 : 0;
      teamStats[match.team1.team_name].losses += team1Won ? 0 : 1;
      teamStats[match.team1.team_name].points_for += match.team1_score;
      teamStats[match.team1.team_name].points_against += match.team2_score;

      // Team 2
      if (!teamStats[match.team2.team_name]) {
        teamStats[match.team2.team_name] = {
          team_name: match.team2.team_name,
          wins: 0,
          losses: 0,
          points_for: 0,
          points_against: 0,
          point_diff: 0
        };
      }
      teamStats[match.team2.team_name].wins += team1Won ? 0 : 1;
      teamStats[match.team2.team_name].losses += team1Won ? 1 : 0;
      teamStats[match.team2.team_name].points_for += match.team2_score;
      teamStats[match.team2.team_name].points_against += match.team1_score;
    });

    const standings = Object.values(teamStats).map(team => ({
      ...team,
      point_diff: team.points_for - team.points_against
    }));

    return standings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });
  };

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  useTournamentRealtime(
    eventId || '',
    () => fetchEventData(),
    () => fetchEventData()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-200 text-xl">Loading tournament...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 bg-slate-900 border-slate-800">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <h1 className="text-2xl font-bold text-slate-100">
              {error || 'Event not found'}
            </h1>
            <p className="text-slate-400">
              This tournament is not available for public viewing.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={`/tournament/${eventId}/live`}>
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <LiveIndicator />
      
      <div className="container mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">{event.name}</h1>
          {event.location && (
            <p className="text-xl text-slate-300">{event.location}</p>
          )}
          <p className="text-lg text-slate-400">
            {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
          </p>
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
            <span>Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Divisions */}
        {divisions.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 p-12">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-2xl text-slate-400">No divisions have been created yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-12">
          {divisions.map(division => {
          const matches = matchesByDivision[division.id] || [];
          const liveMatches = matches.filter(m => m.status === 'in_progress');
          const nextMatches = matches.filter(m => m.status === 'scheduled' && m.court);
          const standings = standingsByDivision[division.id] || [];

          return (
            <div key={division.id}>
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-3xl font-bold">{division.name}</h2>
                <Badge variant={division.status === 'completed' ? 'default' : 'secondary'} className="text-lg px-3 py-1">
                  {division.status}
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Now Playing */}
                <Card className="bg-slate-900 border-slate-800 p-6">
                  <h3 className="text-2xl font-semibold mb-4 text-green-400">Now Playing</h3>
                  {liveMatches.length === 0 ? (
                    <p className="text-slate-400 text-lg">No matches in progress</p>
                  ) : (
                    <div className="space-y-4">
                      {liveMatches.map(match => (
                        <div key={match.id} className="bg-slate-800 rounded-lg p-4">
                          <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                            <span>{match.court?.court_name || `Court ${match.court?.court_number}`}</span>
                            {match.scheduled_time && (
                              <span>• {new Date(match.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-medium">{match.team1.team_name}</span>
                            {match.team1_score !== null && (
                              <span className="text-4xl font-bold">{match.team1_score}</span>
                            )}
                          </div>
                          <div className="text-slate-500 text-center my-1">vs</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-medium">{match.team2.team_name}</span>
                            {match.team2_score !== null && (
                              <span className="text-4xl font-bold">{match.team2_score}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Next Up */}
                <Card className="bg-slate-900 border-slate-800 p-6">
                  <h3 className="text-2xl font-semibold mb-4 text-yellow-400">Next Up</h3>
                  {nextMatches.length === 0 ? (
                    <p className="text-slate-400 text-lg">No matches scheduled</p>
                  ) : (
                    <div className="space-y-4">
                      {nextMatches.slice(0, 5).map(match => (
                        <div key={match.id} className="bg-slate-800 rounded-lg p-4">
                          <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                            <span>{match.court?.court_name || `Court ${match.court?.court_number}` || 'Court TBD'}</span>
                            {match.scheduled_time && (
                              <span>• {new Date(match.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            )}
                          </div>
                          <div className="text-xl font-medium">{match.team1.team_name}</div>
                          <div className="text-slate-500 text-sm my-1">vs</div>
                          <div className="text-xl font-medium">{match.team2.team_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Standings */}
              <Card className="bg-slate-900 border-slate-800 p-6">
                <h3 className="text-2xl font-semibold mb-4">Standings</h3>
                {standings.length === 0 ? (
                  <p className="text-slate-400 text-lg">No completed matches yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-slate-700">
                          <th className="pb-3 text-lg font-semibold text-slate-300">Rank</th>
                          <th className="pb-3 text-lg font-semibold text-slate-300">Team</th>
                          <th className="pb-3 text-lg font-semibold text-slate-300 text-center">W</th>
                          <th className="pb-3 text-lg font-semibold text-slate-300 text-center">L</th>
                          <th className="pb-3 text-lg font-semibold text-slate-300 text-center">PF</th>
                          <th className="pb-3 text-lg font-semibold text-slate-300 text-center">PA</th>
                          <th className="pb-3 text-lg font-semibold text-slate-300 text-center">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((standing, index) => (
                          <tr key={standing.team_name} className="border-b border-slate-800">
                            <td className="py-3 text-xl font-bold text-slate-400">{index + 1}</td>
                            <td className="py-3 text-xl font-medium">{standing.team_name}</td>
                            <td className="py-3 text-xl text-center">{standing.wins}</td>
                            <td className="py-3 text-xl text-center">{standing.losses}</td>
                            <td className="py-3 text-xl text-center">{standing.points_for}</td>
                            <td className="py-3 text-xl text-center">{standing.points_against}</td>
                            <td className="py-3 text-xl text-center font-semibold">
                              <span className={standing.point_diff > 0 ? 'text-green-400' : standing.point_diff < 0 ? 'text-red-400' : ''}>
                                {standing.point_diff > 0 ? '+' : ''}{standing.point_diff}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          );
          })}
        </div>
        )}
      </div>
    </div>
  );
};

export default TournamentLiveView;
