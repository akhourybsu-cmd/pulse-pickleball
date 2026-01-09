import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Loader2,
  Clock,
  MapPin,
  Users,
  Flag
} from "lucide-react";

interface HealthIssue {
  type: "critical" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface TournamentHealthCardProps {
  eventId: string;
  divisionsCount: number;
}

export function TournamentHealthCard({ eventId, divisionsCount }: TournamentHealthCardProps) {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<HealthIssue[]>([]);
  const [stats, setStats] = useState({
    totalMatches: 0,
    completedMatches: 0,
    disputedMatches: 0,
    unscheduledMatches: 0,
    matchesWithoutCourts: 0,
    lowTeamDivisions: 0,
    estimatedCompletion: "",
  });

  useEffect(() => {
    fetchHealthData();
  }, [eventId]);

  const fetchHealthData = async () => {
    setLoading(true);
    const newIssues: HealthIssue[] = [];

    // Fetch all matches for this event
    const { data: divisions } = await supabase
      .from("tournaments_divisions")
      .select("id, name")
      .eq("event_id", eventId);

    if (!divisions || divisions.length === 0) {
      setStats({
        totalMatches: 0,
        completedMatches: 0,
        disputedMatches: 0,
        unscheduledMatches: 0,
        matchesWithoutCourts: 0,
        lowTeamDivisions: 0,
        estimatedCompletion: "No divisions",
      });
      setIssues([]);
      setLoading(false);
      return;
    }

    const divisionIds = divisions.map(d => d.id);

    // Fetch matches
    const { data: matches } = await supabase
      .from("tournaments_matches")
      .select("id, status, court_id, scheduled_time, disputed")
      .in("division_id", divisionIds);

    // Fetch teams per division
    const { data: teams } = await supabase
      .from("tournaments_teams")
      .select("division_id")
      .in("division_id", divisionIds);

    const matchList = matches || [];
    const teamList = teams || [];

    // Calculate stats
    const totalMatches = matchList.length;
    const completedMatches = matchList.filter(m => m.status === "completed").length;
    const disputedMatches = matchList.filter(m => m.disputed).length;
    const unscheduledMatches = matchList.filter(m => !m.scheduled_time && m.status === "scheduled").length;
    const matchesWithoutCourts = matchList.filter(m => !m.court_id && m.status === "scheduled").length;

    // Count teams per division
    const teamsPerDivision = new Map<string, number>();
    teamList.forEach(t => {
      teamsPerDivision.set(t.division_id, (teamsPerDivision.get(t.division_id) || 0) + 1);
    });

    let lowTeamDivisions = 0;
    const lowDivisionNames: string[] = [];
    divisions.forEach(d => {
      const teamCount = teamsPerDivision.get(d.id) || 0;
      if (teamCount < 4 && teamCount > 0) {
        lowTeamDivisions++;
        lowDivisionNames.push(`${d.name} (${teamCount} teams)`);
      }
    });

    // Calculate estimated completion
    const avgMatchDuration = 15; // minutes
    const remainingMatches = totalMatches - completedMatches;
    const estimatedMinutes = remainingMatches * avgMatchDuration;
    const estimatedCompletion = remainingMatches > 0 
      ? `~${Math.ceil(estimatedMinutes / 60)} hours remaining`
      : "Complete";

    setStats({
      totalMatches,
      completedMatches,
      disputedMatches,
      unscheduledMatches,
      matchesWithoutCourts,
      lowTeamDivisions,
      estimatedCompletion,
    });

    // Build issues list

    // Critical issues
    if (disputedMatches > 0) {
      newIssues.push({
        type: "critical",
        icon: <Flag className="h-4 w-4" />,
        title: `${disputedMatches} disputed match${disputedMatches !== 1 ? "es" : ""}`,
        description: "Matches flagged for review - resolve before finalizing",
      });
    }

    if (matchesWithoutCourts > 5 && matchList.filter(m => m.status === "in_progress").length > 0) {
      newIssues.push({
        type: "critical",
        icon: <MapPin className="h-4 w-4" />,
        title: `${matchesWithoutCourts} matches without courts`,
        description: "Assign courts to prevent scheduling delays",
      });
    }

    // Warnings
    if (lowTeamDivisions > 0) {
      newIssues.push({
        type: "warning",
        icon: <Users className="h-4 w-4" />,
        title: `${lowTeamDivisions} division${lowTeamDivisions !== 1 ? "s" : ""} with few teams`,
        description: lowDivisionNames.slice(0, 2).join(", ") + (lowDivisionNames.length > 2 ? "..." : ""),
      });
    }

    if (unscheduledMatches > 0 && completedMatches > 0) {
      newIssues.push({
        type: "warning",
        icon: <Clock className="h-4 w-4" />,
        title: `${unscheduledMatches} matches without scheduled time`,
        description: "Consider scheduling for better organization",
      });
    }

    if (matchesWithoutCourts > 0 && matchesWithoutCourts <= 5) {
      newIssues.push({
        type: "warning",
        icon: <MapPin className="h-4 w-4" />,
        title: `${matchesWithoutCourts} matches without courts`,
        description: "Use auto-assign or manually assign courts",
      });
    }

    // Info
    if (completedMatches > 0 && remainingMatches > 0) {
      newIssues.push({
        type: "info",
        icon: <Info className="h-4 w-4" />,
        title: estimatedCompletion,
        description: `${completedMatches}/${totalMatches} matches complete`,
      });
    }

    setIssues(newIssues);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const criticalCount = issues.filter(i => i.type === "critical").length;
  const warningCount = issues.filter(i => i.type === "warning").length;

  const completionPercent = stats.totalMatches > 0 
    ? Math.round((stats.completedMatches / stats.totalMatches) * 100) 
    : 0;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <CardTitle>Tournament Health</CardTitle>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                {warningCount} Warning{warningCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {criticalCount === 0 && warningCount === 0 && issues.length === 0 && (
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                All Good
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {stats.totalMatches > 0 
            ? `${stats.completedMatches} of ${stats.totalMatches} matches complete`
            : "No matches generated yet"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {stats.totalMatches > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completionPercent}%</span>
            </div>
            <Progress value={completionPercent} className="h-2" />
          </div>
        )}

        {/* Issues list */}
        {issues.length > 0 && (
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div 
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  issue.type === "critical" 
                    ? "bg-destructive/10 border border-destructive/30" 
                    : issue.type === "warning"
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-muted/50"
                }`}
              >
                <span className={
                  issue.type === "critical" 
                    ? "text-destructive" 
                    : issue.type === "warning" 
                    ? "text-amber-600" 
                    : "text-muted-foreground"
                }>
                  {issue.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">{issue.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border/50">
          <div className="text-center">
            <p className="text-2xl font-bold">{divisionsCount}</p>
            <p className="text-xs text-muted-foreground">Divisions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.totalMatches}</p>
            <p className="text-xs text-muted-foreground">Total Matches</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${stats.disputedMatches > 0 ? "text-amber-500" : ""}`}>
              {stats.disputedMatches}
            </p>
            <p className="text-xs text-muted-foreground">Disputed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
