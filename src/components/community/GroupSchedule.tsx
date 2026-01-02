import { useState } from 'react';
import { Calendar, Clock, MapPin, Users, Check, HelpCircle, X, Plus, Trash2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from './GroupEmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGroupEvents, type GroupEvent } from '@/hooks/useGroupEvents';
import { cn } from '@/lib/utils';

interface GroupScheduleProps {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string | null;
}

export function GroupSchedule({ groupId, isAdmin, currentUserId }: GroupScheduleProps) {
  const { events, loading, createEvent, deleteEvent, updateRsvp } = useGroupEvents(groupId);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setStartTime('');
    setEndTime('');
    setLocation('');
    setCapacity('');
  };

  const handleCreate = async () => {
    if (!title.trim() || !startDate || !startTime) return;

    setIsCreating(true);
    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
    const endDateTime = endTime ? new Date(`${startDate}T${endTime}`).toISOString() : undefined;

    const result = await createEvent({
      title: title.trim(),
      description: description.trim() || undefined,
      start_time: startDateTime,
      end_time: endDateTime,
      location_type: 'custom',
      custom_location: location.trim() || undefined,
      capacity: capacity ? parseInt(capacity) : undefined,
    });

    if (result) {
      setCreateDialogOpen(false);
      resetForm();
    }
    setIsCreating(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Event Button */}
      <Button onClick={() => setCreateDialogOpen(true)} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Create Event
      </Button>

      {/* Events List */}
      {events.length === 0 ? (
        <GroupEmptyState
          icon={Calendar}
          title="No upcoming events"
          description="Schedule a session, round robin, or open play for the group."
          actions={[
            { label: 'Create Event', onClick: () => setCreateDialogOpen(true), icon: Plus },
            { label: 'Round Robin', onClick: () => setCreateDialogOpen(true), variant: 'outline', icon: Sparkles },
          ]}
        />
      ) : (
        events.map((event) => {
          const startDate = new Date(event.start_time);
          const endDate = event.end_time ? new Date(event.end_time) : null;
          const isCreator = currentUserId === event.created_by;
          const totalGoing = event.rsvps?.going || 0;
          const isFull = event.capacity ? totalGoing >= event.capacity : false;

          return (
            <Card key={event.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(startDate, 'EEE, MMM d')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(startDate, 'h:mm a')}
                        {endDate && ` - ${format(endDate, 'h:mm a')}`}
                      </div>
                    </div>
                  </div>
                  {(isCreator || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-3">
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}

                {event.custom_location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {event.custom_location}
                  </div>
                )}

                {/* RSVP Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{totalGoing}</span>
                    {event.capacity && (
                      <span className="text-muted-foreground">/ {event.capacity}</span>
                    )}
                    <span className="text-muted-foreground">going</span>
                  </div>
                  {event.rsvps?.maybe ? (
                    <div className="text-muted-foreground">
                      {event.rsvps.maybe} maybe
                    </div>
                  ) : null}
                  {isFull && (
                    <Badge variant="secondary">Full</Badge>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-0">
                <div className="flex items-center gap-2 w-full">
                  <Button
                    variant={event.user_rsvp === 'going' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => updateRsvp(event.id, 'going')}
                    disabled={isFull && event.user_rsvp !== 'going'}
                  >
                    <Check className="h-4 w-4" />
                    Going
                  </Button>
                  <Button
                    variant={event.user_rsvp === 'maybe' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => updateRsvp(event.id, 'maybe')}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Maybe
                  </Button>
                  <Button
                    variant={event.user_rsvp === 'not_going' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => updateRsvp(event.id, 'not_going')}
                  >
                    <X className="h-4 w-4" />
                    Can't Go
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })
      )}

      {/* Create Event Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Schedule a new event for the group
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Friday Night Open Play"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What's this event about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Max Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  placeholder="Unlimited"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Where is this happening?"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!title.trim() || !startDate || !startTime || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
