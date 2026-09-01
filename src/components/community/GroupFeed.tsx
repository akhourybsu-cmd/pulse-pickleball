import { useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Images,
  LayoutList,
  Megaphone,
  MessageSquare,
  MoreVertical,
  Pin,
  Plus,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PostCommentsSheet } from './PostCommentsSheet';
import { GroupEmptyState } from './GroupEmptyState';
import { GroupWelcomeCard } from './GroupWelcomeCard';
import { GroupFeedPlaceholder } from './GroupFeedPlaceholder';
import { CommunityPulse } from './CommunityPulse';
import { ImageLightbox } from './ImageLightbox';
import { PollCard } from './PollCard';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGroupPosts, type GroupPost } from '@/hooks/useGroupPosts';
import { useGroupEvents } from '@/hooks/useGroupEvents';
import { cn } from '@/lib/utils';
import { RoundRobinPostCard } from '@/components/community/posts/RoundRobinPostCard';
import { StaffBadge, useStaffEmphasis } from '@/components/venue/StaffBadge';
import { useVenueStaffUserIds } from '@/components/venue/VenueStaffContext';
import { isInVenueFilter, type VenueFeedFilter } from '@/lib/venues/feed';

interface GroupFeedProps {
  groupId: string;
  groupName?: string;
  isAdmin: boolean;
  currentUserId: string | null;
  venueMode?: boolean;
  /** Static data for the DEV design harness; normal app surfaces omit it. */
  previewPosts?: GroupPost[];
  onOpenQuickPost?: (type: 'post' | 'photo' | 'poll' | 'lfg' | 'announcement') => void;
  onSwitchToEvents?: () => void;
}

const POST_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  announcement: { label: 'Announcement', className: 'bg-amber-500/12 text-amber-600 border-amber-500/35 dark:text-amber-300' },
  lfg: { label: 'LFG', className: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/35 dark:text-emerald-300' },
  highlight: { label: 'Highlight', className: 'bg-purple-500/12 text-purple-600 border-purple-500/35 dark:text-purple-300' },
  poll: { label: 'Poll', className: 'bg-blue-500/12 text-blue-600 border-blue-500/35 dark:text-blue-300' },
  round_robin: { label: 'Round Robin', className: 'bg-primary/12 text-primary border-primary/40' },
  feed: { label: 'Post', className: 'bg-muted text-muted-foreground border-border/60' },
};

// Type accent colors for left border
const POST_TYPE_ACCENT: Record<string, string> = {
  announcement: 'border-l-amber-500',
  lfg: 'border-l-emerald-500',
  highlight: 'border-l-purple-500',
  poll: 'border-l-blue-500',
  round_robin: 'border-l-primary',
  venue: 'border-l-primary',
  feed: 'border-l-border',
};

const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🎾', label: 'Tennis' },
  { emoji: '🔥', label: 'Fire' },
];

const VENUE_FEED_FILTERS: Array<{
  value: VenueFeedFilter;
  label: string;
  icon: typeof LayoutList;
}> = [
  { value: 'all', label: 'All', icon: LayoutList },
  { value: 'venue', label: 'Venue updates', icon: Megaphone },
  { value: 'players', label: 'Find players', icon: UsersRound },
  { value: 'polls', label: 'Polls', icon: BarChart3 },
  { value: 'photos', label: 'Photos', icon: Images },
];

// Date separator component
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 pt-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
      <span className="rounded-full border border-border/70 bg-card px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
    </div>
  );
}

// Get date label for grouping
function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d');
}

export function GroupFeed({ 
  groupId, 
  groupName = 'this group',
  isAdmin, 
  currentUserId,
  venueMode = false,
  previewPosts,
  onOpenQuickPost,
  onSwitchToEvents,
}: GroupFeedProps) {
  const {
    posts: queriedPosts,
    loading: postsLoading,
    deletePost,
    toggleReaction,
    togglePin,
    joinLfgPost,
    leaveLfgPost,
    castPollVote,
  } = useGroupPosts(groupId);
  const posts = previewPosts ?? queriedPosts;
  const { events } = useGroupEvents(groupId);
  const [deleteDialogPost, setDeleteDialogPost] = useState<GroupPost | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState<VenueFeedFilter>('all');
  const staffUserIds = useVenueStaffUserIds();

  // Calculate activity stats
  const activeTodayCount = posts.filter(p => {
    const createdAt = new Date(p.created_at);
    const now = new Date();
    return now.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000;
  }).length;
  
  const sessionsThisWeek = events.length;

  const handleDeletePost = async () => {
    if (!deleteDialogPost) return;
    await deletePost(deleteDialogPost.id);
    setDeleteDialogPost(null);
  };

  const focusComposer = useCallback(() => {
    onOpenQuickPost?.('post');
  }, [onOpenQuickPost]);

  // Memoized handlers
  const handleToggleReaction = useCallback((postId: string, emoji: string) => {
    toggleReaction(postId, emoji);
  }, [toggleReaction]);

  const handleTogglePin = useCallback((postId: string, pinned: boolean) => {
    togglePin(postId, pinned);
  }, [togglePin]);

  const handlePollVote = useCallback((postId: string, optionIdx: number) => {
    castPollVote(postId, optionIdx);
  }, [castPollVote]);

  const handleToggleParticipation = useCallback((post: GroupPost) => {
    return post.user_joined ? leaveLfgPost(post.id) : joinLfgPost(post.id);
  }, [joinLfgPost, leaveLfgPost]);

  const filteredPosts = useMemo(
    () => venueMode
      ? posts.filter((post) => isInVenueFilter(post, venueFilter, staffUserIds))
      : posts,
    [posts, staffUserIds, venueFilter, venueMode],
  );

  // Group posts by date after filtering so the section labels never describe
  // content that is currently hidden.
  const pinnedPosts = useMemo(() => filteredPosts.filter(p => p.pinned), [filteredPosts]);
  const regularPosts = useMemo(() => filteredPosts.filter(p => !p.pinned), [filteredPosts]);

  // Render the feed in windows so a long history doesn't mount hundreds of
  // heavy PostCards at once. All posts are already fetched; this only bounds
  // the DOM. "Load more" reveals the next window.
  const FEED_PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE);
  const visibleRegular = useMemo(
    () => regularPosts.slice(0, visibleCount),
    [regularPosts, visibleCount],
  );
  const hasMoreRegular = regularPosts.length > visibleCount;

  const groupedPosts = useMemo(() => {
    const groups: { label: string; posts: GroupPost[] }[] = [];
    let currentLabel = '';

    visibleRegular.forEach(post => {
      const date = new Date(post.created_at);
      const label = getDateLabel(date);

      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, posts: [post] });
      } else if (groups.length > 0) {
        groups[groups.length - 1].posts.push(post);
      }
    });

    return groups;
  }, [visibleRegular]);

  if (postsLoading && !previewPosts) {
    // Use the post-shaped placeholder (avatar + name + content + reaction
    // row) instead of three generic flat skeleton blocks — the prior
    // heights (28 / 48 / 48) didn't match real post heights, causing a
    // visible layout shift when posts loaded in.
    return <GroupFeedPlaceholder />;
  }

  return (
    <div className="space-y-5 pb-20">
      {venueMode ? (
        <section className="space-y-4" aria-labelledby="venue-feed-heading">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="venue-feed-heading"
                className="text-xl font-semibold tracking-[-0.025em] text-foreground"
              >
                Venue feed
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Updates from {groupName} and the players who play here.
              </p>
            </div>
            {activeTodayCount > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {activeTodayCount} new today
              </span>
            )}
          </div>

          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
            aria-label="Filter venue posts"
          >
            {VENUE_FEED_FILTERS.map(({ value, label, icon: Icon }) => {
              const selected = venueFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setVenueFilter(value);
                    setVisibleCount(FEED_PAGE);
                  }}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                    selected
                      ? 'border-foreground bg-foreground text-background shadow-sm'
                      : 'border-border/70 bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          {onOpenQuickPost && (
            <button
              type="button"
              onClick={() => onOpenQuickPost('post')}
              className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3 text-left shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-colors hover:border-primary/35"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Plus className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Share with {groupName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Post an update, photo, poll, or find players
                </span>
              </span>
            </button>
          )}
        </section>
      ) : (
        <CommunityPulse
          activeTodayCount={activeTodayCount}
          sessionsThisWeek={sessionsThisWeek}
        />
      )}

      {/* Pinned Posts Section */}
      {pinnedPosts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-primary">
            <Pin className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
              {venueMode ? 'Important' : 'Pinned'}
            </span>
          </div>
          <div className={cn(venueMode ? 'space-y-3' : 'space-y-5')}>
            {pinnedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                venueMode={venueMode}
                onDelete={() => setDeleteDialogPost(post)}
                onToggleReaction={handleToggleReaction}
                onTogglePin={handleTogglePin}
                onToggleParticipation={handleToggleParticipation}
                onOpenComments={() => setCommentsPostId(post.id)}
                onImageClick={setLightboxImage}
                onPollVote={handlePollVote}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Posts or Empty State */}
      {posts.length === 0 ? (
        <div className="space-y-4">
          {venueMode ? (
            <GroupEmptyState
              icon={MessageSquare}
              title="Start the venue conversation"
              description={`Share the first update with the ${groupName} community.`}
              actions={onOpenQuickPost ? [{ label: 'Create a post', onClick: focusComposer, icon: Plus }] : []}
              size="sm"
            />
          ) : (
            <>
              <GroupWelcomeCard
                groupName={groupName}
                onPostUpdate={focusComposer}
                onScheduleSession={() => onSwitchToEvents?.()}
                onAskQuestion={focusComposer}
              />
              <GroupFeedPlaceholder />
            </>
          )}
        </div>
      ) : filteredPosts.length === 0 ? (
        <GroupEmptyState
          icon={MessageSquare}
          title="Nothing in this view yet"
          description="Try another filter or create the first post here."
          actions={[
            { label: 'Show all', onClick: () => setVenueFilter('all'), variant: 'outline' },
          ]}
          variant="compact"
          size="sm"
        />
      ) : regularPosts.length === 0 && pinnedPosts.length > 0 ? (
        <GroupEmptyState
          icon={MessageSquare}
          title="No other posts yet"
          description="Start a conversation beyond the pinned content."
          variant="compact"
          size="sm"
        />
      ) : (
        <div className={cn(venueMode ? 'space-y-5' : 'space-y-6')}>
          {groupedPosts.map((group) => (
            <div key={group.label}>
              {/* Date separator - only show if more than one group or not "Today" */}
              {(groupedPosts.length > 1 || group.label !== 'Today') && (
                <DateSeparator label={group.label} />
              )}
              <div className={cn(venueMode ? 'space-y-3' : 'space-y-5')}>
                {group.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    venueMode={venueMode}
                    onDelete={() => setDeleteDialogPost(post)}
                    onToggleReaction={handleToggleReaction}
                    onTogglePin={handleTogglePin}
                    onToggleParticipation={handleToggleParticipation}
                    onOpenComments={() => setCommentsPostId(post.id)}
                    onImageClick={setLightboxImage}
                    onPollVote={handlePollVote}
                  />
                ))}
              </div>
            </div>
          ))}
          {hasMoreRegular && (
            <div className="flex justify-center pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-full border border-border/70 bg-card px-5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground shadow-sm hover:text-foreground"
                onClick={() => setVisibleCount((c) => c + FEED_PAGE)}
              >
                Load more posts
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialogPost} onOpenChange={() => setDeleteDialogPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comments Sheet */}
      <PostCommentsSheet
        open={!!commentsPostId}
        onOpenChange={(open) => !open && setCommentsPostId(null)}
        postId={commentsPostId || ''}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
      
      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}

// Memoized PostCard component with enhanced styling
interface PostCardProps {
  post: GroupPost;
  currentUserId: string | null;
  isAdmin: boolean;
  venueMode?: boolean;
  onDelete: () => void;
  onToggleReaction: (postId: string, emoji: string) => void;
  onTogglePin: (postId: string, pinned: boolean) => void;
  onToggleParticipation?: (post: GroupPost) => Promise<boolean>;
  onOpenComments: () => void;
  onImageClick?: (imageUrl: string) => void;
  onPollVote?: (postId: string, optionIdx: number) => void;
}

const PostCard = memo(function PostCard({
  post,
  currentUserId,
  isAdmin,
  venueMode = false,
  onDelete,
  onToggleReaction,
  onTogglePin,
  onToggleParticipation,
  onOpenComments,
  onImageClick,
  onPollVote,
}: PostCardProps) {
  const navigate = useNavigate();
  const typeInfo = POST_TYPE_BADGES[post.type] || POST_TYPE_BADGES.feed;
  const typeAccent = POST_TYPE_ACCENT[post.type] || POST_TYPE_ACCENT.feed;
  const isAuthor = currentUserId === post.user_id;
  const canManage = isAuthor || isAdmin;
  const { isStaff, ringStyle } = useStaffEmphasis(post.user_id);
  const [participationPending, setParticipationPending] = useState(false);
  const isFull = Boolean(
    post.max_players && (post.participant_count ?? 0) >= post.max_players && !post.user_joined,
  );
  const initials = (post.profile?.display_name || post.profile?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const goToProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.user_id) navigate(`/profile/${post.user_id}`);
  };

  const toggleParticipation = async () => {
    if (!onToggleParticipation || participationPending || isFull) return;
    setParticipationPending(true);
    try {
      await onToggleParticipation(post);
    } finally {
      setParticipationPending(false);
    }
  };

  const sessionDateLabel = post.session_date
    ? format(new Date(`${post.session_date}T00:00:00`), 'EEE, MMM d')
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={isStaff ? ringStyle : undefined}
      className={cn(
        'relative overflow-hidden bg-card p-4 transition-shadow',
        venueMode
          ? 'rounded-[18px] border border-border/70 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_10px_30px_-24px_hsl(var(--foreground)/0.25)] hover:shadow-[0_10px_32px_-20px_hsl(var(--foreground)/0.22)] sm:p-5'
          : 'rounded-2xl border border-border/70 border-l-[4px] shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.14)] hover:shadow-[0_10px_28px_-16px_hsl(var(--foreground)/0.28)]',
        post.pinned && 'border-primary/45 bg-primary/[0.035]',
        !venueMode && (post.pinned ? 'border-l-primary' : typeAccent),
        venueMode && isStaff && 'bg-gradient-to-br from-card via-card to-primary/[0.025]',
      )}
    >
      {venueMode && (post.pinned || isStaff) && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-primary/70"
        />
      )}
      {/* Header - Mobile Optimized */}
      <div className="mb-3 flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
          <button onClick={goToProfile} className="flex-shrink-0" aria-label="View profile">
            <Avatar className={cn('h-9 w-9', venueMode && 'ring-1 ring-border/60 sm:h-10 sm:w-10')}>
              <AvatarImage src={post.profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button onClick={goToProfile} className="max-w-[145px] truncate text-left text-sm font-semibold tracking-[-0.01em] hover:underline sm:max-w-none">
                {post.profile?.display_name || post.profile?.full_name || 'Someone'}
              </button>
              {/* Renders nothing outside a venue, so ordinary communities are
                  unchanged. */}
              <StaffBadge userId={post.user_id} />
              <span className="text-[11px] text-muted-foreground/75 sm:text-xs">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
              {post.type !== 'feed' && (
                <Badge
                  variant="outline"
                  className={cn(
                    'h-5 rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.1em]',
                    typeInfo.className,
                  )}
                >
                  {venueMode && post.type === 'announcement'
                    ? 'Venue update'
                    : venueMode && post.type === 'lfg'
                      ? 'Find players'
                      : typeInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Post overflow — bumped from 28px (well below tap
                  target) to 36px in a corner cluster where 40px would
                  feel too heavy. The dropdown items themselves are
                  comfortable touch targets. */}
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Post options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && (
                <DropdownMenuItem onClick={() => onTogglePin(post.id, !post.pinned)}>
                  <Pin className="h-4 w-4 mr-2" />
                  {post.pinned ? 'Unpin' : 'Pin Post'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="mb-3">
        {post.title && (
          <h3 className={cn('mb-2 font-semibold text-foreground', venueMode ? 'text-[17px] leading-6 tracking-[-0.018em]' : 'text-base')}>
            {post.title}
          </h3>
        )}
        {post.content && (
          <p className={cn(
            'whitespace-pre-wrap',
            venueMode ? 'text-[15px] leading-6 text-foreground/[0.82]' : 'text-sm leading-relaxed text-muted-foreground',
          )}>
            {post.content}
          </p>
        )}

        {post.type === 'lfg' && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-muted/45 px-3 py-2.5 text-xs text-foreground/75">
            {sessionDateLabel && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
                {sessionDateLabel}
              </span>
            )}
            {post.session_time && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden />
                {format(new Date(`2000-01-01T${post.session_time}`), 'h:mm a')}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 font-medium">
              <UsersRound className="h-3.5 w-3.5 text-primary" aria-hidden />
              {post.participant_count ?? 0}{post.max_players ? ` of ${post.max_players}` : ''} joined
            </span>
            {currentUserId && onToggleParticipation && (
              <Button
                type="button"
                size="sm"
                variant={post.user_joined ? 'outline' : 'default'}
                disabled={participationPending || isFull}
                onClick={toggleParticipation}
                className="ml-auto h-8 rounded-lg px-3 text-xs font-semibold"
              >
                {post.user_joined ? (
                  <><Check className="mr-1.5 h-3.5 w-3.5" />Joined</>
                ) : (
                  <><UserPlus className="mr-1.5 h-3.5 w-3.5" />{isFull ? 'Full' : 'Join'}</>
                )}
              </Button>
            )}
          </div>
        )}
        
        {/* Post Image */}
        {post.image_url && (
          <div className={cn('mt-4', !venueMode && '-mx-1')}>
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                'max-h-96 w-full cursor-pointer object-cover transition-opacity hover:opacity-95',
                venueMode ? 'rounded-xl ring-1 ring-border/50' : 'rounded-lg',
              )}
              onClick={() => onImageClick?.(post.image_url!)}
            />
          </div>
        )}

        {/* Poll voting — rendered inline for type='poll' posts that have
            options defined (legacy 'poll' posts without options fall back
            to plain text-only rendering above). */}
        {post.type === 'poll' && post.poll_options && post.poll_options.length >= 2 && (
          <PollCard
            options={post.poll_options}
            counts={post.poll_vote_counts ?? post.poll_options.map(() => 0)}
            myVote={post.poll_my_vote ?? null}
            onVote={(idx) => onPollVote?.(post.id, idx)}
            disabled={!onPollVote || !currentUserId}
          />
        )}

        {/* Round Robin card — embedded sign-up CTA */}
        {post.type === 'round_robin' && post.round_robin && (
          <RoundRobinPostCard rr={post.round_robin} />
        )}
      </div>

      {/* Footer with Enhanced Reactions - Mobile Optimized */}
      <div className={cn('mt-1 flex items-center justify-between border-t border-border/50 pt-2.5', venueMode && 'pt-3')}>
        {/* Grouped reaction rail — glassy pill with a hairline ring. */}
        <div className={cn(
          'flex items-center gap-0.5 rounded-full px-0.5 py-0.5 sm:px-1',
          venueMode ? 'bg-muted/[0.55]' : 'border border-border/60 bg-muted/50 shadow-inner',
        )}>
          {REACTION_EMOJIS.map(({ emoji }) => {
            const reactionData = post.reactions?.find(r => r.emoji === emoji);
            const hasReacted = reactionData?.user_reacted;
            const count = reactionData?.count || 0;

            return (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 gap-0.5 rounded-full px-2 text-xs font-semibold tabular-nums transition-all active:scale-95 sm:gap-1 sm:px-2.5',
                  hasReacted
                    ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)] hover:bg-primary/20'
                    : 'hover:bg-background/80',
                )}
                onClick={() => onToggleReaction(post.id, emoji)}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="text-xs">{count}</span>}
              </Button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-full border border-border/60 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={onOpenComments}
          aria-label="Open comments"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="tabular-nums">{post.comment_count || 0}</span>
        </Button>
      </div>
    </motion.div>
  );
});
