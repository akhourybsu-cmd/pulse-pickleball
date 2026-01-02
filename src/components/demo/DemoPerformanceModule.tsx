import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { demoMatchHistory, demoProfile } from "@/data/demoData";

export const DemoPerformanceModule = () => {
  // Calculate recent form (last 5 matches)
  const recentMatches = demoMatchHistory.slice(0, 5);
  const recentWins = recentMatches.filter(m => m.result === "W").length;
  const recentWinRate = Math.round((recentWins / recentMatches.length) * 100);
  
  // Average rating change
  const avgRatingChange = recentMatches.reduce((sum, m) => sum + m.ratingChange, 0) / recentMatches.length;

  return (
    <div className="space-y-4">
      {/* Recent Matches */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoMatchHistory.slice(0, 4).map((match) => (
            <div 
              key={match.id}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    match.result === "W" 
                      ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                      : "bg-red-500/20 text-red-600 dark:text-red-400"
                  }`}
                >
                  {match.result}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    w/ {match.partner} vs {match.opponents}
                  </p>
                  <p className="text-xs text-muted-foreground">{match.score}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className={`text-xs font-medium ${
                  match.ratingChange > 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {match.ratingChange > 0 ? "+" : ""}{match.ratingChange.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{match.date}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trends */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {/* Recent Form */}
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Last 5</p>
              <div className="flex justify-center gap-1">
                {recentMatches.map((m, i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                      m.result === "W"
                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                        : "bg-red-500/20 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {m.result}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Win Rate (Last 5) */}
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
              <p className="text-lg font-bold text-primary">{recentWinRate}%</p>
            </div>
            
            {/* Avg Rating Change */}
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Avg Δ</p>
              <div className="flex items-center justify-center gap-1">
                {avgRatingChange > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
                <span className={`text-lg font-bold ${
                  avgRatingChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}>
                  {avgRatingChange > 0 ? "+" : ""}{avgRatingChange.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
