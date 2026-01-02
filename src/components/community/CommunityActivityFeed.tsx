import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, MessageCircle, ThumbsUp, Clock, Users, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCommunityActivity, ActivityPost, ActivityEvent } from '@/hooks/useCommunityActivity';

export function CommunityActivityFeed() {
  const { posts, upcomingEvents, loading } = useCommunityActivity();
  const navigate = useNavigate();

  const handlePostClick = (post: ActivityPost) => {
    navigate(`/community/groups/${post.group_id}?tab=feed`);
  };

  const handleEventClick = (event: ActivityEvent) => {
    navigate(`/community/groups/${event.group_id}?tab=schedule`);
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
    <div className="space-y-6">
      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Coming Up
          </h3>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-2">
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
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent Posts
          </h3>
          <div className="space-y-3">
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
      className="w-44 flex-shrink-0 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <Badge variant="secondary" className="text-xs truncate max-w-full">
          {event.group_name}
        </Badge>
        <p className="font-medium text-sm line-clamp-2 whitespace-normal">
          {event.title}
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
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
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{displayName}</span>
              <Badge variant="outline" className="text-xs">
                {post.group_name}
              </Badge>
            </div>
            {post.title && (
              <p className="font-medium text-sm">{post.title}</p>
            )}
            {post.content && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {post.content}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {post.reactions_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.comments_count}
              </span>
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
