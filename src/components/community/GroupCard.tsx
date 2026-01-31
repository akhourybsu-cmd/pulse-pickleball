import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Lock, Globe, Eye, Crown, Shield, ChevronRight, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GroupWithMembership } from '@/hooks/useGroups';
import { fetchGroupPosts } from '@/hooks/useGroupPosts';
import { fetchGroupEvents } from '@/hooks/useGroupEvents';

interface GroupCardProps {
  group: GroupWithMembership;
  showJoinButton?: boolean;
  onJoin?: (groupId: string) => Promise<void>;
  isJoining?: boolean;
}

const typeLabels: Record<string, string> = {
  crew: 'Crew',
  league: 'League',
  open_play: 'Open Play',
  venue_official: 'Venue Official',
  tournament: 'Tournament',
};

const typeColors: Record<string, string> = {
  crew: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  league: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  open_play: 'bg-green-500/10 text-green-600 dark:text-green-400',
  venue_official: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  tournament: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export const GroupCard = memo(function GroupCard({ group, showJoinButton, onJoin, isJoining }: GroupCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMember = !!group.membership;
  
  const roleIcon = group.membership?.role === 'owner' 
    ? <Crown className="h-3 w-3" />
    : group.membership?.role === 'moderator'
    ? <Shield className="h-3 w-3" />
    : null;

  const roleLabel = group.membership?.role === 'owner'
    ? 'Owner'
    : group.membership?.role === 'moderator'
    ? 'Mod'
    : 'Member';

  const isVerifiedVenue = group.type === 'venue_official' && group.is_venue_verified;

  // Generate initials for avatar
  const initials = group.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate a consistent color based on group name
  const colorIndex = group.name.charCodeAt(0) % 6;
  const avatarColors = [
    'bg-primary/15 text-primary',
    'bg-blue-500/15 text-blue-600',
    'bg-green-500/15 text-green-600',
    'bg-amber-500/15 text-amber-600',
    'bg-purple-500/15 text-purple-600',
    'bg-rose-500/15 text-rose-600',
  ];

  // Prefetch group data on hover for instant navigation
  const handleMouseEnter = () => {
    // Prefetch posts
    queryClient.prefetchQuery({
      queryKey: ['group-posts', group.id],
      queryFn: () => fetchGroupPosts(group.id),
      staleTime: 30 * 1000,
    });
    
    // Prefetch events
    queryClient.prefetchQuery({
      queryKey: ['group-events', group.id],
      queryFn: () => fetchGroupEvents(group.id),
      staleTime: 60 * 1000,
    });
  };

  return (
    <button 
      className="w-full text-left p-3 rounded-xl bg-card hover:bg-muted/30 transition-colors border border-border/30 active:scale-[0.99]"
      onClick={() => navigate(`/player/community/group/${group.id}`)}
      onMouseEnter={handleMouseEnter}
    >
      <div className="flex items-center gap-3">
        {/* Avatar - smaller, more refined */}
        <div 
          className={cn(
            'h-11 w-11 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0',
            group.icon_url ? '' : avatarColors[colorIndex]
          )}
          style={group.icon_url ? { backgroundImage: `url(${group.icon_url})`, backgroundSize: 'cover' } : undefined}
        >
          {!group.icon_url && initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-sm text-foreground line-clamp-2 break-words">{group.name}</h3>
            {isVerifiedVenue && (
              <BadgeCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
          </div>
          
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{typeLabels[group.type]}</span>
            <span className="opacity-50">•</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {group.member_count}
            </span>
            {isMember && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {roleIcon}
                  {roleLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unread badge */}
          {group.unread_count && group.unread_count > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {group.unread_count > 99 ? '99+' : group.unread_count}
            </span>
          )}
          {/* Join button for non-members */}
          {showJoinButton && !isMember && onJoin && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs px-3"
              onClick={(e) => {
                e.stopPropagation();
                onJoin(group.id);
              }}
              disabled={isJoining}
            >
              {isJoining ? '...' : group.join_method === 'request_to_join' ? 'Request' : 'Join'}
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </div>
    </button>
  );
});
