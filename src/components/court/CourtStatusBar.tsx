import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";

interface Player {
  id: string;
  display_name: string | null;
  full_name: string;
}

interface CourtAssignment {
  court_number: number;
  status: "live" | "on-deck" | "available";
  players?: Player[];
}

interface CourtStatusBarProps {
  courts: CourtAssignment[];
  totalCourts: number;
}

export function CourtStatusBar({ courts, totalCourts }: CourtStatusBarProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusConfig = (status: string, hasPlayers: boolean) => {
    if (status === "live") {
      return {
        icon: "🔴",
        label: "In Play",
        color: "bg-[hsl(var(--pulse-orange))] text-white",
        borderColor: "border-[hsl(var(--pulse-orange))]",
        bgGradient: "from-orange-500/20 to-orange-600/20",
      };
    }
    if (status === "on-deck") {
      return {
        icon: "🕓",
        label: "Waiting",
        color: "bg-[hsl(var(--pulse-teal))] text-white",
        borderColor: "border-[hsl(var(--pulse-teal))] animate-pulse",
        bgGradient: "from-teal-500/20 to-teal-600/20",
      };
    }
    return {
      icon: "🟢",
      label: "Available",
      color: "bg-muted text-muted-foreground",
      borderColor: "border-border",
      bgGradient: "from-muted/50 to-muted/30",
    };
  };

  // Create array of all courts
  const allCourts: CourtAssignment[] = Array.from({ length: totalCourts }, (_, i) => {
    const courtNum = i + 1;
    const existingCourt = courts.find((c) => c.court_number === courtNum);
    return (
      existingCourt || {
        court_number: courtNum,
        status: "available" as const,
        players: [],
      }
    );
  });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-secondary">Courts</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {allCourts.map((court, index) => {
          const config = getStatusConfig(court.status, !!court.players?.length);
          const playerCount = court.players?.length || 0;

          return (
            <motion.div
              key={court.court_number}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card
                className={`border-2 ${config.borderColor} overflow-hidden transition-all hover:shadow-md`}
              >
                <CardContent className={`p-4 bg-gradient-to-br ${config.bgGradient}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-secondary">
                        Court {court.court_number}
                      </span>
                      <Badge className={config.color}>
                        <span className="mr-1">{config.icon}</span>
                        {config.label}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {playerCount}/4
                    </span>
                  </div>

                  {court.players && court.players.length > 0 ? (
                    <div className="flex -space-x-2">
                      {court.players.slice(0, 4).map((player) => (
                        <Avatar
                          key={player.id}
                          className="w-8 h-8 border-2 border-background"
                        >
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {getInitials(player.display_name || player.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Court open — ready for next game
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
