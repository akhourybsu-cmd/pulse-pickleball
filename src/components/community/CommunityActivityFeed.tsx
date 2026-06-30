import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, MessageCircle, ThumbsUp, Clock, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCommunityActivity, ActivityPost, ActivityEvent } from '@/hooks/useCommunityActivity';

export function CommunityActivityFeed() {
  const { posts, upcomingEvents, loading } = useCommunityActivity();
  const navigate = useNavigate();

  // Routes had two bugs: missing /player prefix and pluralized "groups".
  // Actual route per App.tsx is /player/community/group/:groupId. The
  // ?tab= search params were also no-ops since GroupDetail's active tab
  // is local React state, not URL-driven — dropped them to avoid
  // suggesting a behavior we don't honor.
  const handlePostClick = (post: ActivityPost) => {
    navigate(`/player/community/group/${post.group_id}`);
  };

  const handleEventClick = (event: ActivityEvent) => {
    navigate(`/player/community/group/${event.group_id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-28 w-40 rounded-lg flex-shrink-0" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasNoActivity = posts.length === 0 && upcomingEvents.length === 0;

  if (hasNoActivity) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
          <p className="text-muted-foreground max-w-sm">
            Join some groups to see posts and events from your community here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Coming Up
          </h3>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-2">
              {upcomingEvents.slice(0, 5).map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onClick={() => handleEventClick(event)} 
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Recent Posts Section */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent Posts
          </h3>
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onClick={() => handlePostClick(post)} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, onClick }: { event: ActivityEvent; onClick: () => void }) {
  const eventDate = new Date(event.start_time);
  const spotsText = event.capacity
    ? `${event.rsvp_count}/${event.capacity}`
    : `${event.rsvp_count} going`;

  return (
    <Card
      className={cn(
        'w-52 flex-shrink-0 cursor-pointer border-border/40',
        // Premium feel: soft primary gradient on hover instead of a
        // flat accent/30 wash, slight ring on the date "stamp."
        'bg-gradient-to-br from-primary/[0.04] to-transparent',
        'hover:from-primary/10 hover:border-primary/30 transition-all duration-200',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Group name surfaced as quiet caption text, not a pill —
            the pill chrome was visually heavy for what is metadata. */}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 truncate font-medium">
          {event.group_name}
        </p>
        <p className="font-semibold text-sm line-clamp-2 whitespace-normal leading-snug">
          {event.title}
        </p>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>{format(eventDate, 'EEE, MMM d')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{format(eventDate, 'h:mm a')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            <span>{spotsText}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post, onClick }: { post: ActivityPost; onClick: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const displayName = post.profile?.display_name || 'Anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Card
      className={cn(
        'cursor-pointer border-border/40 transition-all duration-200',
        // Subtle premium shading on hover — primary tint replaces the
        // generic accent wash. Group name moves from a pill to a caption.
        'hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/[0.03] hover:to-transparent',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0 ring-1 ring-border/40">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            {/* Header line: name + dot + group name as quiet caption. */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold">{displayName}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground truncate">{post.group_name}</span>
            </div>
            {post.title && (
              <p className="font-medium text-sm">{post.title}</p>
            )}
            {post.content && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {post.content}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground/80 pt-1.5">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {post.reactions_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.comments_count}
              </span>
              <span className="opacity-40">·</span>
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
