import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus } from "lucide-react";

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
        <h2 className="text-2xl font-bold">Next Up Boxes</h2>
        <Badge variant="outline" className="text-sm">
          <Users className="w-4 h-4 mr-1" />
          {boxEntries.length} waiting
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: numBoxes }, (_, i) => i + 1).map((boxNum) => {
          const players = boxGroups.get(boxNum) || [];
          const isFull = players.length >= 4;
          const isUserInBox = userBox === boxNum;
          const canJoin = !userBox && !isFull;

          return (
            <Card
              key={boxNum}
              className={`relative transition-all ${
                isFull
                  ? "border-primary bg-primary/5"
                  : isUserInBox
                  ? "border-accent bg-accent/10"
                  : "hover:shadow-md"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Box {boxNum}</CardTitle>
                  <Badge variant={isFull ? "default" : "secondary"}>
                    {players.length}/4
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 min-h-[120px]">
                  {players.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-secondary/50"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
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
                          {entry.profiles.current_rating.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: 4 - players.length }, (_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-2 p-2 rounded-md border-2 border-dashed border-muted"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted" />
                      <p className="text-xs text-muted-foreground">Empty slot</p>
                    </div>
                  ))}
                </div>

                {isUserInBox ? (
                  <Button
                    onClick={onLeaveBox}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Leave Box
                  </Button>
                ) : canJoin ? (
                  <Button
                    onClick={() => onJoinBox(boxNum)}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Join Box
                  </Button>
                ) : (
                  <Button
                    disabled
                    size="sm"
                    variant="secondary"
                    className="w-full"
                  >
                    {isFull ? "Full" : "Already in a box"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
