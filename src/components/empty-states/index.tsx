import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  PlusCircle,
  Search,
  Gamepad2,
  ClipboardList
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Pre-configured empty states for common scenarios across the app.
 * These provide consistent messaging and actionable CTAs.
 */

interface EmptyStateConfigProps {
  onAction?: () => void;
  className?: string;
}

/** No events found in browse/discovery */
export function NoEventsEmptyState({ onAction, className }: EmptyStateConfigProps) {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={Calendar}
      title="No events found"
      description="There are no upcoming events in your area yet. Browse venues or check back soon."
      actions={[
        {
          label: 'Browse Venues',
          onClick: onAction || (() => navigate('/play?tab=venues')),
          icon: Search,
        },
        {
          label: 'Create Event',
          onClick: () => navigate('/events/new'),
          variant: 'outline',
          icon: PlusCircle,
        },
      ]}
      className={className}
    />
  );
}

/** No venues found in discovery */
export function NoVenuesEmptyState({ onAction, className }: EmptyStateConfigProps) {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon={MapPin}
      title="No venues found"
      description="Venues will appear here once they register with Pulse. Know a venue that should be listed?"
      actions={[
        {
          label: 'Register a Venue',
          onClick: onAction || (() => navigate('/venue/create-fast')),
          icon: PlusCircle,
        },
      ]}
      className={className}
    />
  );
}

/** No matches recorded yet (for new players) */
export function NoMatchesEmptyState({ onAction, className }: EmptyStateConfigProps) {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon={Trophy}
      title="No matches yet"
      description="Record your first match to start tracking your progress and build your player rating!"
      actions={[
        {
          label: 'Record a Match',
          onClick: onAction || (() => navigate('/player/matches/new')),
          icon: PlusCircle,
        },
      ]}
      className={className}
    />
  );
}

/** No community groups joined */
export function NoCommunityEmptyState({ onAction, className }: EmptyStateConfigProps) {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon={Users}
      title="No communities yet"
      description="Join a group to connect with other players, organize games, and participate in events."
      actions={[
        {
          label: 'Browse Communities',
          onClick: onAction || (() => navigate('/player/community')),
          icon: Search,
        },
      ]}
      className={className}
    />
  );
}

/** No registrations for events */
export function NoRegistrationsEmptyState({ onAction, className }: EmptyStateConfigProps) {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon={ClipboardList}
      title="No registrations"
      description="You haven't registered for any events yet. Browse upcoming events to find something you'd like to join!"
      actions={[
        {
          label: 'Browse Events',
          onClick: onAction || (() => navigate('/play')),
          icon: Search,
        },
      ]}
      className={className}
    />
  );
}

/** No venue events (for venue admins) */
export function NoVenueEventsEmptyState({ onAction, className }: EmptyStateConfigProps) {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon={Calendar}
      title="No events scheduled"
      description="Create your first event to start attracting players and building your community!"
      actions={[
        {
          label: 'Create Event',
          onClick: onAction || (() => navigate('/venue/events')),
          icon: PlusCircle,
        },
      ]}
      className={className}
    />
  );
}

/** No players looking for game */
export function NoLFGEmptyState({ onAction, className }: EmptyStateConfigProps) {
  return (
    <EmptyState
      icon={Gamepad2}
      title="No one's looking for a game"
      description="Be the first to post that you're looking for players!"
      actions={onAction ? [
        {
          label: 'Find Players',
          onClick: onAction,
          icon: PlusCircle,
        },
      ] : []}
      className={className}
      size="sm"
    />
  );
}

/** Generic search with no results */
export function NoSearchResultsEmptyState({ 
  searchTerm,
  onClear,
  className 
}: EmptyStateConfigProps & { searchTerm?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={searchTerm 
        ? `No results match "${searchTerm}". Try adjusting your search.`
        : "Try adjusting your search or filters."
      }
      actions={onClear ? [
        {
          label: 'Clear Search',
          onClick: onClear,
          variant: 'outline',
        },
      ] : []}
      className={className}
      size="sm"
    />
  );
}
