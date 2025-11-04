import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, LogOut, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface Player {
  id: string;
  display_name: string | null;
  full_name: string;
  current_rating: number;
}

interface BoxEntry {
  id: string;
  player_id: string;
  box_number: number;
  profiles: Player;
}

interface QueueBoxSystemProps {
  sessionId: string;
  userId: string | null;
  boxEntries: BoxEntry[];
  onJoinBox: (boxNumber: number) => void;
  onLeaveBox: () => void;
  numBoxes?: number;
}

export function QueueBoxSystem({
  userId,
  boxEntries,
  onJoinBox,
  onLeaveBox,
  numBoxes = 12,
}: QueueBoxSystemProps) {
  // Group entries by box number
  const boxGroups = new Map<number, BoxEntry[]>();
  for (let i = 1; i <= numBoxes; i++) {
    boxGroups.set(i, []);
  }
  
  boxEntries.forEach((entry) => {
    if (entry.box_number && entry.box_number <= numBoxes) {
      const group = boxGroups.get(entry.box_number) || [];
      group.push(entry);
      boxGroups.set(entry.box_number, group);
    }
  });

  const userBox = boxEntries.find(entry => entry.player_id === userId)?.box_number;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-secondary flex items-center gap-2">
          Next Up
          <Sparkles className="w-5 h-5 text-[hsl(var(--pulse-teal))]" />
        </h2>
        <Badge 
          variant="outline" 
          className="text-sm border-[hsl(var(--pulse-teal))] text-[hsl(var(--pulse-teal))]"
        >
          <Users className="w-4 h-4 mr-1" />
          {boxEntries.length} waiting
        </Badge>
      </div>
      
      {boxEntries.length === 0 ? (
        <Card className="border-2 border-dashed border-muted">
          <CardContent className="py-12 text-center space-y-3">
            <div className="text-4xl">🏓</div>
            <p className="text-lg font-medium text-secondary">
              No one's up next — join the action!
            </p>
            <p className="text-sm text-muted-foreground">
              Tap a box below to get in the game
            </p>
          </CardContent>
        </Card>
      ) : null}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: numBoxes }, (_, i) => i + 1).map((boxNum, index) => {
          const players = boxGroups.get(boxNum) || [];
          const isFull = players.length >= 4;
          const isUserInBox = userBox === boxNum;
          const canJoin = !userBox && !isFull;
          const fillPercentage = (players.length / 4) * 100;

          return (
            <motion.div
              key={boxNum}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card
                className={`relative overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg ${
                  isFull
                    ? "border-2 border-[hsl(var(--pulse-success))] bg-gradient-to-br from-[hsl(var(--pulse-success))]/10 to-[hsl(var(--pulse-success))]/5"
                    : isUserInBox
                    ? "border-2 border-[hsl(var(--pulse-teal))] bg-gradient-to-br from-[hsl(var(--pulse-teal))]/10 to-[hsl(var(--pulse-teal))]/5 animate-pulse"
                    : players.length > 0
                    ? "border-2 border-[hsl(var(--pulse-teal))]/30 bg-gradient-to-br from-[hsl(var(--pulse-teal))]/5 to-transparent"
                    : "border-2 border-dashed border-muted"
                }`}
              >
                {/* Progress bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
                  <motion.div
                    className="h-full bg-[hsl(var(--pulse-teal))]"
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPercentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-secondary">
                      Next Game {boxNum}
                    </CardTitle>
                    <Badge 
                      variant={isFull ? "default" : "secondary"}
                      className={isFull ? "bg-[hsl(var(--pulse-success))] text-white" : ""}
                    >
                      {isFull ? "Ready ✓" : `${players.length}/4`}
                    </Badge>
                  </div>
                </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 min-h-[140px]">
                  {players.map((entry, idx) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                      className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border shadow-sm"
                    >
                      <Avatar className="w-8 h-8 border-2 border-[hsl(var(--pulse-teal))]">
                        <AvatarFallback className="text-xs bg-[hsl(var(--pulse-teal))] text-white">
                          {getInitials(
                            entry.profiles.display_name || entry.profiles.full_name
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.profiles.display_name || entry.profiles.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rating: {entry.profiles.current_rating.toFixed(2)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {Array.from({ length: 4 - players.length }, (_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-2 p-2 rounded-lg border-2 border-dashed border-muted/50 bg-muted/20"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted/50" />
                      <p className="text-xs text-muted-foreground italic">
                        Waiting for player…
                      </p>
                    </div>
                  ))}
                </div>

                {isUserInBox ? (
                  <Button
                    onClick={onLeaveBox}
                    variant="outline"
                    size="sm"
                    className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave Queue
                  </Button>
                ) : canJoin ? (
                  <Button
                    onClick={() => onJoinBox(boxNum)}
                    size="sm"
                    className="w-full bg-[hsl(var(--pulse-teal))] hover:bg-[hsl(var(--pulse-teal))]/90 text-white shadow-lg shadow-[hsl(var(--pulse-teal))]/20"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Join Game
                  </Button>
                ) : (
                  <Button
                    disabled
                    size="sm"
                    variant="secondary"
                    className="w-full opacity-50"
                  >
                    {isFull ? "🎉 Match Ready!" : "🔒 You're already queued up"}
                  </Button>
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
