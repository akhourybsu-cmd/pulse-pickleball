import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface CourtCardProps {
  courtNumber: number;
  teamA: string[];
  teamB: string[];
  status: "in-progress" | "final";
  scoreA?: number;
  scoreB?: number;
  onEnterScore: () => void;
}

export function CourtCard({
  courtNumber,
  teamA,
  teamB,
  status,
  scoreA,
  scoreB,
  onEnterScore,
}: CourtCardProps) {
  const isFinal = status === "final";

  return (
    <Card
      className={`relative overflow-hidden transition-all ${
        isFinal
          ? 'border-muted-foreground/30 bg-card'
          : 'border-[hsl(var(--accent))] border-2 shadow-lg shadow-[hsl(var(--accent))]/20 animate-pulse-border'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-accent to-primary" />
      
      <CardContent className="p-6 space-y-4">
        {/* Court Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-3xl font-bold">Court {courtNumber}</h3>
          {isFinal && (
            <Badge variant="default" className="text-lg px-3 py-1 bg-green-600">
              <CheckCircle2 className="w-5 h-5 mr-1" />
              Final
            </Badge>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-6">
          {/* Team A */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground font-medium">TEAM A</div>
            <div className="text-2xl font-bold">
              {teamA[0]} {teamA[1] && `/ ${teamA[1]}`}
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xl font-bold text-muted-foreground">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Team B */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground font-medium">TEAM B</div>
            <div className="text-2xl font-bold">
              {teamB[0]} {teamB[1] && `/ ${teamB[1]}`}
            </div>
          </div>
        </div>

        {/* Status / Score */}
        <div className="pt-4 border-t">
          {isFinal ? (
            <div className="text-center">
              <div className="text-lg font-medium text-muted-foreground mb-2">Final Score</div>
              <div className="text-4xl font-bold">
                <span className={scoreA! > scoreB! ? 'text-green-600' : ''}>{scoreA}</span>
                <span className="mx-3">–</span>
                <span className={scoreB! > scoreA! ? 'text-green-600' : ''}>{scoreB}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-lg font-medium text-muted-foreground">
                In Progress
              </div>
              <Button
                onClick={onEnterScore}
                size="lg"
                className="w-full h-16 text-xl font-bold bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/90 text-[hsl(var(--accent-foreground))]"
              >
                Enter Score
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
