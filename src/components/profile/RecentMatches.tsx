import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Match {
  id: string;
  opponent_name: string;
  result: 'W' | 'L';
  score: string;
  date: string;
}

interface RecentMatchesProps {
  matches: Match[];
}

export const RecentMatches = ({ matches }: RecentMatchesProps) => {
  if (matches.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Matches</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex-shrink-0 w-[200px] p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={match.result === 'W' ? 'default' : 'destructive'}>
                    {match.result}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="font-semibold text-sm mb-1 truncate">{match.opponent_name}</p>
                <p className="text-xs text-muted-foreground">{match.score}</p>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
