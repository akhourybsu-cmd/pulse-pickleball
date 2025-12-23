import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PublicVenue, VenueEvent } from '@/hooks/usePublicVenue';

interface PublicEventsTabProps {
  venue: PublicVenue;
  events: VenueEvent[];
  onRegister: (event: VenueEvent) => void;
  registeredEventIds?: string[];
}

export function PublicEventsTab({ venue, events, onRegister, registeredEventIds = [] }: PublicEventsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  // Get unique event types and skill levels
  const eventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.event_type));
    return Array.from(types);
  }, [events]);

  const skillLevels = useMemo(() => {
    const levels = new Set(events.filter(e => e.skill_level).map(e => e.skill_level!));
    return Array.from(levels);
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!event.title.toLowerCase().includes(query) && 
            !event.description?.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Type filter
      if (typeFilter !== 'all' && event.event_type !== typeFilter) {
        return false;
      }
      
      // Skill filter
      if (skillFilter !== 'all' && event.skill_level !== skillFilter) {
        return false;
      }
      
      return true;
    });
  }, [events, searchQuery, typeFilter, skillFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Filters */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 space-y-3">
        <h2 className="text-xl font-semibold" style={{ color: secondaryColor }}>
          Upcoming Events
        </h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {eventTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {skillLevels.length > 0 && (
            <Select value={skillFilter} onValueChange={setSkillFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Skill Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {skillLevels.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Events List */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {events.length === 0 
                  ? "No upcoming events at this venue" 
                  : "No events match your filters"}
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              const isRegistered = registeredEventIds.includes(event.id);
              const isFull = event.max_participants 
                ? event.current_participants >= event.max_participants 
                : false;
              
              return (
                <Card key={event.id} className="overflow-hidden">
                  <div 
                    className="h-1.5"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Date Box */}
                      <div 
                        className="flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span className="text-xs font-medium uppercase">
                          {format(new Date(event.start_time), 'MMM')}
                        </span>
                        <span className="text-xl font-bold leading-none">
                          {format(new Date(event.start_time), 'd')}
                        </span>
                      </div>
                      
                      {/* Event Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                          >
                            {event.event_type}
                          </Badge>
                          {event.skill_level && (
                            <Badge variant="secondary" className="text-xs">
                              {event.skill_level}
                            </Badge>
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-base mb-2">{event.title}</h3>
                        
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {event.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                          </span>
                          {event.max_participants && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {event.current_participants}/{event.max_participants} spots
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {event.price !== null && event.price > 0 ? (
                            <span className="font-semibold text-lg" style={{ color: primaryColor }}>
                              ${event.price}
                            </span>
                          ) : (
                            <Badge variant="secondary">Free</Badge>
                          )}
                          
                          <Button
                            onClick={() => onRegister(event)}
                            disabled={isRegistered || isFull}
                            style={!isRegistered && !isFull ? { backgroundColor: primaryColor } : undefined}
                          >
                            {isRegistered 
                              ? 'Registered' 
                              : isFull 
                                ? 'Full' 
                                : 'Register'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
          
          {/* Extra padding */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}
