import { Download, Printer, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportMenuProps {
  divisionId: string;
  divisionName: string;
}

export const ExportMenu = ({ divisionId, divisionName }: ExportMenuProps) => {
  const exportStandingsCSV = async () => {
    try {
      const { data: teams, error: teamsError } = await supabase
        .from('tournaments_teams')
        .select('id, team_name, seed_number')
        .eq('division_id', divisionId)
        .order('seed_number');

      if (teamsError) throw teamsError;

      const { data: matches, error: matchesError } = await supabase
        .from('tournaments_matches')
        .select(`
          team1_id,
          team2_id,
          team1_score,
          team2_score,
          status
        `)
        .eq('division_id', divisionId)
        .eq('status', 'completed');

      if (matchesError) throw matchesError;

      const standings = teams?.map(team => {
        const teamMatches = matches?.filter(
          m => m.team1_id === team.id || m.team2_id === team.id
        ) || [];

        const wins = teamMatches.filter(m =>
          (m.team1_id === team.id && (m.team1_score || 0) > (m.team2_score || 0)) ||
          (m.team2_id === team.id && (m.team2_score || 0) > (m.team1_score || 0))
        ).length;

        const losses = teamMatches.length - wins;

        const pointsFor = teamMatches.reduce((sum, m) => {
          return sum + (m.team1_id === team.id ? (m.team1_score || 0) : (m.team2_score || 0));
        }, 0);

        const pointsAgainst = teamMatches.reduce((sum, m) => {
          return sum + (m.team1_id === team.id ? (m.team2_score || 0) : (m.team1_score || 0));
        }, 0);

        return {
          team: team.team_name,
          seed: team.seed_number,
          wins,
          losses,
          pointsFor,
          pointsAgainst,
          pointDiff: pointsFor - pointsAgainst
        };
      }) || [];

      const csv = [
        ['Team', 'Seed', 'Wins', 'Losses', 'Points For', 'Points Against', 'Point Diff'],
        ...standings.map(s => [
          s.team,
          s.seed || '',
          s.wins,
          s.losses,
          s.pointsFor,
          s.pointsAgainst,
          s.pointDiff
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${divisionName}-standings.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Standings exported to CSV");
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export standings");
    }
  };

  const printSchedule = () => {
    window.print();
    toast.success("Opening print dialog");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportStandingsCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export Standings (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={printSchedule}>
          <Printer className="h-4 w-4 mr-2" />
          Print Schedule
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
