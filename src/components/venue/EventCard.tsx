import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Clock, Users, DollarSign, MoreVertical, Eye, EyeOff, Trash2, Edit, Trophy, GraduationCap, PartyPopper, Medal } from 'lucide-react';
import { VenueEvent } from '@/hooks/useVenueEvents';
import { format } from 'date-fns';

interface EventCardProps {
  event: VenueEvent;
  onTogglePublish: (id: string, isPublished: boolean) => void;
  onDelete: (id: string) => void;
}

export function EventCard({ event, onTogglePublish, onDelete }: EventCardProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tournament': return Trophy;
      case 'clinic': return GraduationCap;
      case 'social': return PartyPopper;
      case 'league': return Medal;
      default: return Calendar;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'tournament': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'clinic': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'social': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'league': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const TypeIcon = getTypeIcon(event.event_type);
  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold truncate">{event.title}</h3>
              <Badge variant="outline" className={getTypeColor(event.event_type)}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {event.event_type}
              </Badge>
              {event.is_published ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  <Eye className="h-3 w-3 mr-1" />
                  Published
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Draft
                </Badge>
              )}
            </div>

            {event.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {event.description}
              </p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(startTime, 'MMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}</span>
              </div>

              {event.max_participants && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>{event.current_participants}/{event.max_participants}</span>
                </div>
              )}

              {event.price !== null && event.price > 0 && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>${event.price.toFixed(2)}</span>
                </div>
              )}

              {event.skill_level && (
                <Badge variant="secondary" className="text-xs">
                  {event.skill_level}
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onTogglePublish(event.id, !event.is_published)}>
                {event.is_published ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Publish
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
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Event</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{event.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(event.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
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
