import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Calendar, Clock } from "lucide-react";

interface CourtAnalyticsProps {
  courtId: string;
}

interface AnalyticsData {
  totalCheckIns: number;
  activeNow: number;
  peakDay: string;
  peakHour: number;
  avgDuration: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CourtAnalytics({ courtId }: CourtAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [courtId]);

  const fetchAnalytics = async () => {
    // Get all check-ins (all-time)
    const { data: checkIns } = await (supabase as any)
      .from("court_checkins")
      .select("*")
      .eq("court_id", courtId);

    if (!checkIns || checkIns.length === 0) {
      setAnalytics({
        totalCheckIns: 0,
        activeNow: 0,
        peakDay: 'N/A',
        peakHour: 0,
        avgDuration: 0,
      });
      return;
    }

    // Calculate active now
    const now = new Date();
    const activeNow = checkIns.filter((c: any) => {
      const endsAt = new Date(c.ends_at);
      const checkedOut = c.checked_out_at ? new Date(c.checked_out_at) : null;
      return (!checkedOut || checkedOut > now) && endsAt > now;
    }).length;

    // Find peak day
    const dayCount = new Map<number, number>();
    checkIns.forEach((c: any) => {
      const day = new Date(c.created_at).getDay();
      dayCount.set(day, (dayCount.get(day) || 0) + 1);
    });
    
    let peakDay = 0;
    let maxCount = 0;
    dayCount.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count;
        peakDay = day;
      }
    });

    // Find peak hour
    const hourCount = new Map<number, number>();
    checkIns.forEach((c: any) => {
      const hour = new Date(c.created_at).getHours();
      hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
    });
    
    let peakHour = 0;
    maxCount = 0;
    hourCount.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    });

    // Calculate average duration
    const durations = checkIns
      .filter((c: any) => c.checked_out_at)
      .map((c: any) => {
        const start = new Date(c.created_at).getTime();
        const end = new Date(c.checked_out_at).getTime();
        return (end - start) / (1000 * 60); // minutes
      });
    
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    setAnalytics({
      totalCheckIns: checkIns.length,
      activeNow,
      peakDay: DAYS[peakDay],
      peakHour,
      avgDuration: Math.round(avgDuration),
    });
  };

  if (!analytics) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Check-ins</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.totalCheckIns}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Now</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.activeNow}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Peak Day</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.peakDay}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.avgDuration}m</div>
          <p className="text-xs text-muted-foreground mt-1">
            Peak: {analytics.peakHour % 12 || 12}{analytics.peakHour >= 12 ? 'pm' : 'am'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
