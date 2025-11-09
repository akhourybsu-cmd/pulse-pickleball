import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface MatchTypeBreakdownProps {
  courtId: string;
}

interface MatchTypeData {
  type: string;
  count: number;
  percentage: number;
}

export function MatchTypeBreakdown({ courtId }: MatchTypeBreakdownProps) {
  const [data, setData] = useState<MatchTypeData[]>([]);

  useEffect(() => {
    fetchMatchTypes();
  }, [courtId]);

  const fetchMatchTypes = async () => {
    // Get all approved, non-voided matches (all-time)
    const { data: matches } = await supabase
      .from("matches")
      .select(`
        match_type,
        match_participants!inner(player_id)
      `)
      .eq("court_id", courtId)
      .eq("status", "approved")
      .eq("voided", false);

    if (!matches || matches.length === 0) {
      setData([]);
      return;
    }

    // Get player IDs to filter test accounts
    const playerIds = Array.from(new Set(
      matches.flatMap((m: any) => m.match_participants.map((p: any) => p.player_id))
    ));

    // Fetch profiles to check test accounts
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .in("id", playerIds)
      .is("is_test_account", null);

    const validPlayerIds = new Set(profiles?.map(p => p.id) || []);

    // Filter out matches with test accounts
    const validMatches = matches.filter((match: any) => 
      match.match_participants.every((p: any) => validPlayerIds.has(p.player_id))
    );

    // Count by type
    const typeCount = new Map<string, number>();
    validMatches.forEach((match: any) => {
      const type = match.match_type || 'casual';
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    });

    const total = validMatches.length;
    const breakdown: MatchTypeData[] = Array.from(typeCount.entries())
      .map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    setData(breakdown);
  };

  if (data.length === 0) {
    return null;
  }

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
  ];

  const chartConfig = data.reduce((config, item, index) => ({
    ...config,
    [item.type.toLowerCase()]: {
      label: item.type,
      color: COLORS[index % COLORS.length],
    },
  }), {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Match Type Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percentage }) => `${percentage.toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: any) => (
                  <span className="text-sm">
                    {value} ({entry.payload.count})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
