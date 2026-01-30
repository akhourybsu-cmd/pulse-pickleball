import { Calendar, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { OnlineIndicator } from './OnlineIndicator';
import type { GroupMember } from '@/hooks/useGroups';

interface GroupSnapshotProps {
  members: GroupMember[];
  nextEvent?: { title: string; date: string } | null;
  weeklyStats?: { posts: number };
  onCreateEvent?: () => void;
  onViewFeed?: () => void;
  onlineCount?: number;
  onlineUserIds?: string[];
}

export function GroupSnapshot({ 
  members, 
  nextEvent, 
  weeklyStats = { posts: 0 },
  onCreateEvent,
  onViewFeed,
  onlineCount = 0,
  onlineUserIds = [],
}: GroupSnapshotProps) {
  // Get first 4 members for avatar stack
  const displayMembers = members.slice(0, 4);
  const remainingCount = Math.max(0, members.length - 4);

  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-muted/20 rounded-xl text-sm overflow-x-auto">
      {/* Member Avatars with Online Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex -space-x-2">
          {displayMembers.map((member) => {
            const initials = (member.profile?.display_name || member.profile?.full_name || 'U')
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            
            const isOnline = onlineUserIds.includes(member.user_id);
            
            return (
              <div key={member.id} className="relative">
                <Avatar className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                {isOnline && (
                  <OnlineIndicator 
                    isOnline={true} 
                    size="sm" 
                    showPulse={false}
                    className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
                  />
                )}
              </div>
            );
          })}
        </div>
        {remainingCount > 0 && (
          <span className="text-xs text-muted-foreground/70">+{remainingCount}</span>
        )}
        {onlineCount > 0 && (
          <span className="text-xs text-emerald-600 font-medium">• {onlineCount} online</span>
        )}
      </div>

      <div className="h-5 w-px bg-border/50 flex-shrink-0" />

      {/* Next Event */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        {nextEvent ? (
          <span className="text-muted-foreground">
            Next: <span className="text-foreground font-medium">{nextEvent.title}</span>
          </span>
        ) : (
          <Button 
            variant="link" 
            size="sm" 
            className="h-auto p-0 text-xs text-primary"
            onClick={onCreateEvent}
          >
            Create event →
          </Button>
        )}
      </div>

      <div className="h-5 w-px bg-border/50 flex-shrink-0" />

      {/* Weekly Stats - Actionable */}
      <div className="flex items-center gap-3 text-muted-foreground/70 flex-shrink-0">
        <button 
          onClick={onViewFeed}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{weeklyStats.posts} posts</span>
        </button>
      </div>
    </div>
  );
}
