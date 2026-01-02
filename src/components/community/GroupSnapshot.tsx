import { Calendar, MessageSquare, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { GroupMember } from '@/hooks/useGroups';

interface GroupSnapshotProps {
  members: GroupMember[];
  nextEvent?: { title: string; date: string } | null;
  weeklyStats?: { posts: number };
  onCreateEvent?: () => void;
  onViewFeed?: () => void;
}

export function GroupSnapshot({ 
  members, 
  nextEvent, 
  weeklyStats = { posts: 0 },
  onCreateEvent,
  onViewFeed,
}: GroupSnapshotProps) {
  // Get first 4 members for avatar stack
  const displayMembers = members.slice(0, 4);
  const remainingCount = Math.max(0, members.length - 4);

  return (
    <div className="flex items-center gap-4 py-2 px-3 bg-muted/30 rounded-lg text-sm overflow-x-auto">
      {/* Member Avatars */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex -space-x-2">
          {displayMembers.map((member, index) => {
            const initials = (member.profile?.display_name || member.profile?.full_name || 'U')
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            
            return (
              <Avatar key={member.id} className="h-7 w-7 border-2 border-background">
                <AvatarImage src={member.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
            );
          })}
        </div>
        {remainingCount > 0 && (
          <span className="text-xs text-muted-foreground">+{remainingCount}</span>
        )}
      </div>

      <div className="h-4 w-px bg-border flex-shrink-0" />

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

      <div className="h-4 w-px bg-border flex-shrink-0" />

      {/* Weekly Stats - Actionable */}
      <div className="flex items-center gap-3 text-muted-foreground flex-shrink-0">
        <button 
          onClick={onViewFeed}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{weeklyStats.posts} posts</span>
        </button>
      </div>
    </div>
  );
}
