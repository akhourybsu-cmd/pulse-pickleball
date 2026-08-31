import { useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Pin, Trash2, MoreVertical, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { PostCommentsSheet } from './PostCommentsSheet';
import { GroupEmptyState } from './GroupEmptyState';
import { GroupWelcomeCard } from './GroupWelcomeCard';
import { GroupFeedPlaceholder } from './GroupFeedPlaceholder';
import { CommunityPulse } from './CommunityPulse';
import { ComposerQuickActions } from './ComposerQuickActions';
import { ImageLightbox } from './ImageLightbox';
import { PollCard } from './PollCard';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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

interface GroupFeedProps {
  groupId: string;
  groupName?: string;
  isAdmin: boolean;
  currentUserId: string | null;
  onOpenQuickPost?: (type: 'post' | 'poll' | 'lfg') => void;
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
  onOpenQuickPost,
  onSwitchToEvents,
}: GroupFeedProps) {
  const { posts, loading, createPost, deletePost, toggleReaction, togglePin, castPollVote } = useGroupPosts(groupId);
  const { events } = useGroupEvents(groupId);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [deleteDialogPost, setDeleteDialogPost] = useState<GroupPost | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Calculate activity stats
  const activeTodayCount = posts.filter(p => {
    const createdAt = new Date(p.created_at);
    const now = new Date();
    return now.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000;
  }).length;
  
  const sessionsThisWeek = events.length;

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    
    setIsPosting(true);
    const result = await createPost({
      type: 'feed',
      content: newPostContent.trim(),
    });
    
    if (result) {
      setNewPostContent('');
    }
    setIsPosting(false);
  };

  const handleDeletePost = async () => {
    if (!deleteDialogPost) return;
    await deletePost(deleteDialogPost.id);
    setDeleteDialogPost(null);
  };

  const focusComposer = useCallback(() => {
    document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }, []);

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

  // Group posts by date
  const pinnedPosts = useMemo(() => posts.filter(p => p.pinned), [posts]);
  const regularPosts = useMemo(() => posts.filter(p => !p.pinned), [posts]);

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

  if (loading) {
    // Use the post-shaped placeholder (avatar + name + content + reaction
    // row) instead of three generic flat skeleton blocks — the prior
    // heights (28 / 48 / 48) didn't match real post heights, causing a
    // visible layout shift when posts loaded in.
    return <GroupFeedPlaceholder />;
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Anchored Community Status Bar */}
      <CommunityPulse
        activeTodayCount={activeTodayCount}
        sessionsThisWeek={sessionsThisWeek}
      />

      {/* Pinned Posts Section */}
      {pinnedPosts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-primary">
            <Pin className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Pinned</span>
          </div>
          <div className="space-y-5">
            {pinnedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDelete={() => setDeleteDialogPost(post)}
                onToggleReaction={handleToggleReaction}
                onTogglePin={handleTogglePin}
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
          <GroupWelcomeCard
            groupName={groupName}
            onPostUpdate={focusComposer}
            onScheduleSession={() => onSwitchToEvents?.()}
            onAskQuestion={focusComposer}
          />
          <GroupFeedPlaceholder />
        </div>
      ) : regularPosts.length === 0 && pinnedPosts.length > 0 ? (
        <GroupEmptyState
          icon={MessageSquare}
          title="No other posts yet"
          description="Start a conversation beyond the pinned content."
          variant="compact"
          size="sm"
        />
      ) : (
        <div className="space-y-6">
          {groupedPosts.map((group, groupIndex) => (
            <div key={group.label}>
              {/* Date separator - only show if more than one group or not "Today" */}
              {(groupedPosts.length > 1 || group.label !== 'Today') && (
                <DateSeparator label={group.label} />
              )}
              <div className="space-y-5">
                {group.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onDelete={() => setDeleteDialogPost(post)}
                    onToggleReaction={handleToggleReaction}
                    onTogglePin={handleTogglePin}
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
  onDelete: () => void;
  onToggleReaction: (postId: string, emoji: string) => void;
  onTogglePin: (postId: string, pinned: boolean) => void;
  onOpenComments: () => void;
  onImageClick?: (imageUrl: string) => void;
  onPollVote?: (postId: string, optionIdx: number) => void;
}

const PostCard = memo(function PostCard({
  post,
  currentUserId,
  isAdmin,
  onDelete,
  onToggleReaction,
  onTogglePin,
  onOpenComments,
  onImageClick,
  onPollVote,
}: PostCardProps) {
  const navigate = useNavigate();
  const typeInfo = POST_TYPE_BADGES[post.type] || POST_TYPE_BADGES.feed;
  const typeAccent = POST_TYPE_ACCENT[post.type] || POST_TYPE_ACCENT.feed;
  const isAuthor = currentUserId === post.user_id;
  const canManage = isAuthor || isAdmin;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        // Each post is its own distinct slab: full-strength border, a real
        // lifted shadow, and a type-colored spine on the left edge.
        'relative overflow-hidden rounded-2xl bg-card p-4 transition-shadow',
        'border border-border/70 border-l-[4px]',
        'shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.14)] hover:shadow-[0_10px_28px_-16px_hsl(var(--foreground)/0.28)]',
        post.pinned
          ? 'border-primary/45 border-l-primary bg-primary/[0.06]'
          : typeAccent,
      )}
    >
      {/* Header - Mobile Optimized */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
          <button onClick={goToProfile} className="flex-shrink-0" aria-label="View profile">
            <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
              <AvatarImage src={post.profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button onClick={goToProfile} className="font-medium text-sm truncate max-w-[120px] sm:max-w-none hover:underline text-left">
                {post.profile?.display_name || post.profile?.full_name || 'Someone'}
              </button>
              <span className="text-xs text-muted-foreground/70">
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
                  {typeInfo.label}
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
              <Button variant="ghost" size="icon" className="h-9 w-9">
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
          <h3 className="font-medium text-base mb-2">{post.title}</h3>
        )}
        {post.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
        )}
        
        {/* Post Image */}
        {post.image_url && (
          <div className="mt-3 -mx-1">
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full rounded-lg object-cover max-h-80 cursor-pointer hover:opacity-95 transition-opacity"
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
      <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-2.5">
        {/* Grouped reaction rail — glassy pill with a hairline ring. */}
        <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/50 px-0.5 py-0.5 shadow-inner sm:px-1">
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
