import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Clock } from "lucide-react";

interface Player {
  id: string;
  display_name: string | null;
  full_name: string;
  current_rating: number | null;
}

interface CourtAssignment {
  court_number: number;
  status: 'live' | 'on-deck';
  players: Player[];
}

interface WhosUpBoardProps {
  courtAssignments: CourtAssignment[];
  waitingPlayers: Player[];
  totalCourts: number;
  currentUserId?: string | null;
}

export function WhosUpBoard({ 
  courtAssignments, 
  waitingPlayers, 
  totalCourts,
  currentUserId 
}: WhosUpBoardProps) {
  const getPlayerInitials = (player: Player) => {
    const name = player.display_name || player.full_name;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getPlayerName = (player: Player) => {
    return player.display_name || player.full_name;
  };

  const isCurrentUser = (playerId: string) => {
    return currentUserId === playerId;
  };

  // Create array of all courts (filled + empty)
  const allCourts = Array.from({ length: totalCourts }, (_, i) => {
    const courtNum = i + 1;
    return courtAssignments.find(c => c.court_number === courtNum) || null;
  });

  return (
    <div className="space-y-6">
      {/* Courts Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold">Courts</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCourts.map((court, index) => {
            const courtNum = index + 1;
            
            if (!court) {
              return (
                <Card key={courtNum} className="rounded-2xl border-2 border-dashed border-muted shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                        {courtNum}
                      </div>
                      <span className="font-semibold text-muted-foreground">Court {courtNum}</span>
                      <Badge variant="outline" className="ml-auto">Empty</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Waiting for players
                    </p>
                  </CardContent>
                </Card>
              );
            }

            const isLive = court.status === 'live';
            const userIsPlaying = court.players.some(p => isCurrentUser(p.id));

            return (
              <Card 
                key={courtNum} 
                className={`rounded-2xl border-2 shadow-lg transition-all ${
                  isLive ? 'border-primary shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(169,220,61,0.15)]' : 'border-orange-500 shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(249,115,22,0.15)]'
                } ${userIsPlaying ? 'ring-2 ring-blue-500' : ''} hover:-translate-y-1`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      isLive ? 'bg-primary text-primary-foreground' : 'bg-orange-500 text-white'
                    }`}>
                      {court.court_number}
                    </div>
                    <span className="font-semibold">Court {court.court_number}</span>
                    <Badge 
                      variant={isLive ? "default" : "secondary"} 
                      className="ml-auto"
                    >
                      {isLive ? 'Playing' : 'Next Up'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {court.players.map((player, idx) => (
                      <div 
                        key={player.id} 
                        className={`flex items-center gap-2 p-2 rounded ${
                          isCurrentUser(player.id) ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500' : 'bg-secondary/30'
                        }`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {getPlayerInitials(player)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {getPlayerName(player)}
                            {isCurrentUser(player.id) && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {player.current_rating?.toFixed(2) || "3.00"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {idx < 2 ? 'T1' : 'T2'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Waiting Queue */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="text-2xl font-bold">Next Up</h2>
          <Badge variant="outline" className="ml-auto">
            {waitingPlayers.length} waiting
          </Badge>
        </div>
        
        {waitingPlayers.length === 0 ? (
          <Card className="rounded-2xl border-2 border-dashed shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No players in queue. Join now to get on a court!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {waitingPlayers.map((player, index) => (
              <Card 
                key={player.id}
                className={`rounded-xl transition-all shadow-md ${
                  isCurrentUser(player.id) 
                    ? 'border-2 border-blue-500 shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(59,130,246,0.15)] hover:-translate-y-1' 
                    : 'border hover:shadow-lg hover:-translate-y-1'
                }`}
              >
                <CardContent className="p-3 text-center">
                  <div className="relative mb-2">
                    <Avatar className="w-12 h-12 mx-auto">
                      <AvatarFallback>
                        {getPlayerInitials(player)}
                      </AvatarFallback>
                    </Avatar>
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {index + 1}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium truncate">
                    {getPlayerName(player)}
                    {isCurrentUser(player.id) && (
                      <span className="block text-xs text-blue-600 dark:text-blue-400">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {player.current_rating?.toFixed(2) || "3.00"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
