import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Calendar, Clock, Users, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMinutes, setHours, setMinutes, isBefore, isAfter, addDays } from "date-fns";
import { formatTournamentLabel } from "@/lib/formatLabels";

interface Division {
  id: string;
  name: string;
  format: string;
  max_teams: number | null;
  estimated_match_duration: number | null;
  scheduled_day: number | null;
  scheduled_start_time: string | null;
}

interface Team {
  id: string;
  team_name: string;
  division_id: string;
}

interface Match {
  id: string;
  division_id: string;
  team1_id: string;
  team2_id: string;
  scheduled_time: string | null;
  court_id: string | null;
  round_number: number;
  status: string;
}

interface TimeSlot {
  time: Date;
  label: string;
  matches: Match[];
}

interface TournamentSchedulerProps {
  eventId: string;
  startDate: string;
  endDate: string;
  numCourts?: number;
}

export function TournamentScheduler({ eventId, startDate, endDate, numCourts = 4 }: TournamentSchedulerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");

  const eventDays = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    let current = start;
    let dayNum = 1;
    while (isBefore(current, end) || format(current, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      days.push({ date: new Date(current), dayNumber: dayNum });
      current = addDays(current, 1);
      dayNum++;
    }
    return days;
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    setLoading(true);
    
    // First fetch divisions
    const { data: divisionsData } = await supabase
      .from("tournaments_divisions")
      .select("id, name, format, max_teams, estimated_match_duration, scheduled_day, scheduled_start_time")
      .eq("event_id", eventId);

    if (divisionsData) {
      setDivisions(divisionsData);
      
      // Then fetch teams for those divisions
      const divisionIds = divisionsData.map(d => d.id);
      if (divisionIds.length > 0) {
        const { data: teamsData } = await supabase
          .from("tournaments_teams")
          .select("id, team_name, division_id")
          .in("division_id", divisionIds);
        
        if (teamsData) setTeams(teamsData);
      }
    }

    // Fetch matches
    const { data: matchesData } = await supabase
      .from("tournaments_matches")
      .select("id, division_id, team1_id, team2_id, scheduled_time, court_id, round_number, status")
      .in("division_id", divisions.map(d => d.id) || [])
      .order("scheduled_time", { ascending: true });

    if (matchesData) setMatches(matchesData);
    
    setLoading(false);
  };

  // Generate time slots from 7 AM to 9 PM in 30-minute increments
  const timeSlots = useMemo(() => {
    const slots: TimeSlot[] = [];
    const currentDayDate = eventDays[selectedDay - 1]?.date || new Date(startDate);
    
    for (let hour = 7; hour <= 21; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotTime = setMinutes(setHours(currentDayDate, hour), min);
        slots.push({
          time: slotTime,
          label: format(slotTime, "h:mm a"),
          matches: matches.filter(m => {
            if (!m.scheduled_time) return false;
            const matchTime = new Date(m.scheduled_time);
            return format(matchTime, "HH:mm") === format(slotTime, "HH:mm") &&
              format(matchTime, "yyyy-MM-dd") === format(currentDayDate, "yyyy-MM-dd");
          }),
        });
      }
    }
    return slots;
  }, [selectedDay, eventDays, matches, startDate]);

  // Filter matches for selected division
  const filteredMatches = useMemo(() => {
    if (selectedDivision === "all") return matches;
    return matches.filter(m => m.division_id === selectedDivision);
  }, [matches, selectedDivision]);

  // Calculate conflicts (overlapping matches on same court)
  const conflicts = useMemo(() => {
    const conflictList: { match1: Match; match2: Match; reason: string }[] = [];
    
    filteredMatches.forEach((m1, i) => {
      filteredMatches.slice(i + 1).forEach(m2 => {
        if (m1.court_id && m2.court_id && m1.court_id === m2.court_id) {
          if (m1.scheduled_time && m2.scheduled_time) {
            const t1 = new Date(m1.scheduled_time);
            const t2 = new Date(m2.scheduled_time);
            const division1 = divisions.find(d => d.id === m1.division_id);
            const duration1 = division1?.estimated_match_duration || 30;
            const end1 = addMinutes(t1, duration1);
            
            if (isAfter(end1, t2) && isBefore(t1, t2)) {
              conflictList.push({
                match1: m1,
                match2: m2,
                reason: `Court overlap`,
              });
            }
          }
        }
      });
    });
    
    return conflictList;
  }, [filteredMatches, divisions]);

  // Stats for the day
  const dayStats = useMemo(() => {
    const dayMatches = filteredMatches.filter(m => {
      if (!m.scheduled_time) return false;
      const matchDate = new Date(m.scheduled_time);
      const dayDate = eventDays[selectedDay - 1]?.date;
      return dayDate && format(matchDate, "yyyy-MM-dd") === format(dayDate, "yyyy-MM-dd");
    });

    const scheduledCount = dayMatches.length;
    const unscheduledCount = filteredMatches.filter(m => !m.scheduled_time).length;
    const totalDuration = dayMatches.reduce((sum, m) => {
      const div = divisions.find(d => d.id === m.division_id);
      return sum + (div?.estimated_match_duration || 30);
    }, 0);

    return { scheduledCount, unscheduledCount, totalDuration };
  }, [filteredMatches, selectedDay, eventDays, divisions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tournament Scheduler</h2>
          <p className="text-muted-foreground">Plan match times and court assignments</p>
        </div>
      </div>

      {/* Day Selector and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}
            disabled={selectedDay <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">
              Day {selectedDay} - {eventDays[selectedDay - 1] && format(eventDays[selectedDay - 1].date, "EEE, MMM d")}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDay(Math.min(eventDays.length, selectedDay + 1))}
            disabled={selectedDay >= eventDays.length}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={selectedDivision} onValueChange={setSelectedDivision}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Divisions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            {divisions.map(div => (
              <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{dayStats.scheduledCount}</p>
                <p className="text-sm text-muted-foreground">Matches Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{dayStats.unscheduledCount}</p>
                <p className="text-sm text-muted-foreground">Unscheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{Math.round(dayStats.totalDuration / 60)}h</p>
                <p className="text-sm text-muted-foreground">Est. Court Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={conflicts.length > 0 ? "border-destructive" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${conflicts.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <p className="text-2xl font-bold">{conflicts.length}</p>
                <p className="text-sm text-muted-foreground">Conflicts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Court Schedule Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Court Schedule</CardTitle>
          <CardDescription>
            {numCourts} courts available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="min-w-[800px]">
              {/* Header Row */}
              <div className="grid gap-1 sticky top-0 bg-background z-10 pb-2 border-b" 
                style={{ gridTemplateColumns: `80px repeat(${numCourts}, 1fr)` }}>
                <div className="text-sm font-medium text-muted-foreground">Time</div>
                {Array.from({ length: numCourts }, (_, i) => (
                  <div key={i} className="text-sm font-medium text-center">
                    Court {i + 1}
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {timeSlots.map((slot, slotIndex) => (
                <div
                  key={slotIndex}
                  className="grid gap-1 border-b border-muted/50 hover:bg-muted/30"
                  style={{ gridTemplateColumns: `80px repeat(${numCourts}, 1fr)` }}
                >
                  <div className="text-xs text-muted-foreground py-2 pr-2">
                    {slot.label}
                  </div>
                  {Array.from({ length: numCourts }, (_, courtIndex) => {
                    const courtNum = courtIndex + 1;
                    // For now, we'll match by court index since court_id is a UUID
                    const matchesOnCourt = slot.matches;
                    
                    return (
                      <div
                        key={courtIndex}
                        className="min-h-[40px] p-1 border-l border-muted/30"
                      >
                        {courtIndex === 0 && matchesOnCourt.map(match => {
                          const division = divisions.find(d => d.id === match.division_id);
                          return (
                            <div
                              key={match.id}
                              className="bg-primary/10 border border-primary/20 rounded px-2 py-1 text-xs"
                            >
                              <div className="font-medium truncate">
                                {division?.name || "Match"}
                              </div>
                              <div className="text-muted-foreground">
                                R{match.round_number}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Division Schedule Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Division Schedule</CardTitle>
          <CardDescription>Overview of when each division is scheduled to play</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {divisions.map(division => {
              const divMatches = matches.filter(m => m.division_id === division.id);
              const scheduled = divMatches.filter(m => m.scheduled_time).length;
              const total = divMatches.length;
              
              return (
                <div key={division.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{formatTournamentLabel(division.format)}</Badge>
                    <span className="font-medium">{division.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {division.scheduled_day && (
                      <span className="text-muted-foreground">Day {division.scheduled_day}</span>
                    )}
                    {division.scheduled_start_time && (
                      <span className="text-muted-foreground">{division.scheduled_start_time}</span>
                    )}
                    <Badge variant={scheduled === total ? "default" : "secondary"}>
                      {scheduled}/{total} scheduled
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
