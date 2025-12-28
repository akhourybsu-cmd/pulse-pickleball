import { useNavigate } from 'react-router-dom';
import { Users, Lock, Globe, Eye, Crown, Shield, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GroupWithMembership } from '@/hooks/useGroups';

interface GroupCardProps {
  group: GroupWithMembership;
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

export function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();
  
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

  const visibilityIcon = group.visibility === 'private'
    ? <Lock className="h-3 w-3" />
    : group.visibility === 'unlisted'
    ? <Eye className="h-3 w-3" />
    : <Globe className="h-3 w-3" />;

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
    'bg-primary/20 text-primary',
    'bg-blue-500/20 text-blue-600',
    'bg-green-500/20 text-green-600',
    'bg-amber-500/20 text-amber-600',
    'bg-purple-500/20 text-purple-600',
    'bg-rose-500/20 text-rose-600',
  ];

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all duration-200 border-border/50"
      onClick={() => navigate(`/player/community/group/${group.id}`)}
    >
      <CardHeader className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div 
            className={cn(
              'h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0',
              group.icon_url ? '' : avatarColors[colorIndex]
            )}
            style={group.icon_url ? { backgroundImage: `url(${group.icon_url})`, backgroundSize: 'cover' } : undefined}
          >
            {!group.icon_url && initials}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
              {visibilityIcon}
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Role badge */}
              <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0">
                {roleIcon}
                {roleLabel}
              </Badge>
              
              {/* Type badge */}
              <Badge variant="outline" className={cn('text-xs px-1.5 py-0', typeColors[group.type])}>
                {typeLabels[group.type]}
              </Badge>

              {/* Member count */}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {group.member_count}
              </span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Unread badge */}
            {group.unread_count && group.unread_count > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs px-2 min-w-[20px] justify-center">
                {group.unread_count > 99 ? '99+' : group.unread_count}
              </Badge>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
