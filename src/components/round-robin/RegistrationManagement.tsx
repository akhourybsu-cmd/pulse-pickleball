import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserMinus, UserPlus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface RegistrationManagementProps {
  eventId: string;
  maxPlayers: number;
  registrationDeadline: string;
  isOrganizer: boolean;
}

export function RegistrationManagement({ 
  eventId, 
  maxPlayers, 
  registrationDeadline,
  isOrganizer 
}: RegistrationManagementProps) {
  const { data: players = [], refetch } = useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_robin_players')
        .select(`
          id,
          player_id,
          registration_status,
          joined_at,
          profiles:profiles_public!round_robin_players_player_id_fkey(full_name, display_name)
        `)
        .eq('event_id', eventId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  const confirmed = players.filter(p => p.registration_status === 'confirmed');
  const waitlisted = players.filter(p => p.registration_status === 'waitlisted');

  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Remove ${playerName} from this event? They can rejoin later.`)) return;

    try {
      const { error } = await supabase
        .from('round_robin_players')
        .delete()
        .eq('event_id', eventId)
        .eq('player_id', playerId);

      if (error) throw error;
      toast.success('Player removed - they can rejoin later');
      refetch();
    } catch (error) {
      console.error('Remove error:', error);
      toast.error('Failed to remove player');
    }
  };

  const handlePromoteFromWaitlist = async (playerId: string, playerName: string) => {
    try {
      const { error } = await supabase
        .from('round_robin_players')
        .update({ registration_status: 'confirmed' })
        .eq('event_id', eventId)
        .eq('player_id', playerId);

      if (error) throw error;
      toast.success(`${playerName} confirmed!`);
      refetch();
    } catch (error) {
      console.error('Promote error:', error);
      toast.error('Failed to promote player');
    }
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}/round-robin/${eventId}`;
    navigator.clipboard.writeText(url);
    toast.success('Event link copied to clipboard!');
  };

  const PlayerRow = ({ 
    player, 
    onRemove, 
    onPromote 
  }: { 
    player: any;
    onRemove?: () => void;
    onPromote?: () => void;
  }) => {
    const playerName = player.profiles?.display_name || player.profiles?.full_name || 'Unknown';
    const initials = playerName.split(' ').map((n: string) => n[0]).join('').toUpperCase();

    return (
      <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{playerName}</p>
            <p className="text-xs text-muted-foreground">
              Joined {format(new Date(player.joined_at), 'MMM d, h:mm a')}
            </p>
          </div>
        </div>
        {isOrganizer && (
          <div className="flex gap-1">
            {onPromote && (
              <Button
                size="sm"
                variant="outline"
                onClick={onPromote}
                title="Confirm registration"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemove}
                title="Remove player"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Registration Status</CardTitle>
            <CardDescription>
              {confirmed.length} / {maxPlayers} confirmed
              {waitlisted.length > 0 && ` • ${waitlisted.length} waitlisted`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareLink}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Capacity</span>
            <span className="font-medium">{Math.round((confirmed.length / maxPlayers) * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min((confirmed.length / maxPlayers) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Confirmed Players */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Confirmed Players</h4>
            <Badge variant="default">{confirmed.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {confirmed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No confirmed players yet
              </p>
            ) : (
              confirmed.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  onRemove={isOrganizer ? () => handleRemovePlayer(
                    player.player_id,
                    player.profiles?.display_name || player.profiles?.full_name || 'Unknown'
                  ) : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/* Waitlist */}
        {waitlisted.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Waitlist</h4>
              <Badge variant="secondary">{waitlisted.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {waitlisted.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  onPromote={isOrganizer ? () => handlePromoteFromWaitlist(
                    player.player_id,
                    player.profiles?.display_name || player.profiles?.full_name || 'Unknown'
                  ) : undefined}
                  onRemove={isOrganizer ? () => handleRemovePlayer(
                    player.player_id,
                    player.profiles?.display_name || player.profiles?.full_name || 'Unknown'
                  ) : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
