import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface CourtHeatmapProps {
  courtId: string;
}

interface HeatmapData {
  hour: number;
  day: number;
  count: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

export function CourtHeatmap({ courtId }: CourtHeatmapProps) {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [maxCount, setMaxCount] = useState(0);

  useEffect(() => {
    fetchHeatmapData();
  }, [courtId]);

  const fetchHeatmapData = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch check-ins from the last 30 days
    const { data: checkIns } = await (supabase as any)
      .from("court_checkins")
      .select("created_at")
      .eq("court_id", courtId)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (!checkIns) return;

    // Group by day of week and hour
    const grouped = new Map<string, number>();
    checkIns.forEach((checkIn: any) => {
      const date = new Date(checkIn.created_at);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    const heatmapData: HeatmapData[] = [];
    let max = 0;

    for (let day = 0; day < 7; day++) {
      for (const hour of HOURS) {
        const key = `${day}-${hour}`;
        const count = grouped.get(key) || 0;
        heatmapData.push({ day, hour, count });
        if (count > max) max = count;
      }
    }

    setData(heatmapData);
    setMaxCount(max);
  };

  const getOpacity = (count: number) => {
    if (maxCount === 0) return 0.1;
    return Math.max(0.1, (count / maxCount) * 0.9);
  };

  const getCellData = (day: number, hour: number) => {
    return data.find(d => d.day === day && d.hour === hour);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Court Activity Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground mb-4">
          Last 30 days • Darker = More Active
        </div>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid grid-cols-[auto_repeat(14,1fr)] gap-1">
              {/* Header row with hours */}
              <div className="h-8" />
              {HOURS.map(hour => (
                <div key={hour} className="text-xs text-center text-muted-foreground h-8 flex items-center justify-center">
                  {hour % 12 || 12}{hour >= 12 ? 'p' : 'a'}
                </div>
              ))}

              {/* Rows for each day */}
              {DAYS.map((day, dayIndex) => (
                <>
                  <div key={`label-${dayIndex}`} className="text-xs text-muted-foreground pr-2 flex items-center justify-end h-8">
                    {day}
                  </div>
                  {HOURS.map(hour => {
                    const cellData = getCellData(dayIndex, hour);
                    const count = cellData?.count || 0;
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className="h-8 rounded transition-all hover:ring-2 hover:ring-primary cursor-pointer"
                        style={{
                          backgroundColor: `hsl(var(--primary) / ${getOpacity(count)})`,
                        }}
                        title={`${day} ${hour}:00 - ${count} check-in${count !== 1 ? 's' : ''}`}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
