import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mail, Phone, DollarSign, MoreVertical, UserCheck, UserX, Trash2 } from 'lucide-react';
import { VenueCoach } from '@/hooks/useVenueCoaches';

interface CoachCardProps {
  coach: VenueCoach;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

export function CoachCard({ coach, onToggleActive, onDelete }: CoachCardProps) {
  const initials = coach.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className={`transition-all ${!coach.is_active ? 'opacity-60' : 'hover:shadow-md'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={coach.avatar_url || undefined} alt={coach.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{coach.name}</h3>
              {!coach.is_active && (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 text-sm text-muted-foreground">
              {coach.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{coach.email}</span>
                </div>
              )}

              {coach.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{coach.phone}</span>
                </div>
              )}

              {coach.hourly_rate && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>${coach.hourly_rate}/hr</span>
                </div>
              )}
            </div>

            {coach.bio && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {coach.bio}
              </p>
            )}

            {coach.specialties && coach.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {coach.specialties.map(specialty => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggleActive(coach.id, !coach.is_active)}>
                {coach.is_active ? (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Mark Inactive
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Mark Active
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Coach
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Coach</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {coach.name}? This will also delete all their scheduled lessons.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(coach.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
