import { useState, useCallback, useMemo, memo } from 'react';
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

interface GroupFeedProps {
  groupId: string;
  groupName?: string;
  isAdmin: boolean;
  currentUserId: string | null;
  onOpenQuickPost?: (type: 'post' | 'poll' | 'lfg') => void;
  onSwitchToEvents?: () => void;
}

const POST_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  announcement: { label: 'Announcement', className: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  lfg: { label: 'LFG', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  highlight: { label: 'Highlight', className: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  poll: { label: 'Poll', className: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  feed: { label: 'Post', className: 'bg-muted text-muted-foreground' },
};

// Type accent colors for left border
const POST_TYPE_ACCENT: Record<string, string> = {
  announcement: 'border-l-amber-500',
  lfg: 'border-l-emerald-500',
  highlight: 'border-l-purple-500',
  poll: 'border-l-blue-500',
  venue: 'border-l-primary',
  feed: 'border-l-transparent',
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
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border/30" />
      <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/30" />
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
  
  const groupedPosts = useMemo(() => {
    const groups: { label: string; posts: GroupPost[] }[] = [];
    let currentLabel = '';
    
    regularPosts.forEach(post => {
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
  }, [regularPosts]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
            <Pin className="h-3 w-3" />
            <span className="font-medium uppercase tracking-wide">Pinned</span>
          </div>
          <div className="space-y-4">
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
        <div className="space-y-4">
          {groupedPosts.map((group, groupIndex) => (
            <div key={group.label}>
              {/* Date separator - only show if more than one group or not "Today" */}
              {(groupedPosts.length > 1 || group.label !== 'Today') && (
                <DateSeparator label={group.label} />
              )}
              <div className="space-y-4">
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-xl bg-card border transition-colors',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        'border-l-[3px]',
        post.pinned ? 'border-primary/20 bg-primary/5 border-l-primary' : cn('border-border/30', typeAccent)
      )}
    >
      {/* Header - Mobile Optimized */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-none">
                {post.profile?.display_name || post.profile?.full_name || 'Unknown'}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
              {post.type !== 'feed' && (
                <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', typeInfo.className)}>
                  {typeInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
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
      </div>

      {/* Footer with Enhanced Reactions - Mobile Optimized */}
      <div className="pt-2 flex items-center justify-between border-t border-border/15">
        {/* Grouped reaction container - smaller on mobile */}
        <div className="flex items-center gap-0.5 bg-muted/40 rounded-full px-0.5 sm:px-1 py-0.5">
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
                  'h-6 sm:h-7 gap-0.5 sm:gap-1 px-1.5 sm:px-2 text-xs rounded-full transition-all',
                  hasReacted && 'bg-primary/15 text-primary hover:bg-primary/20',
                  !hasReacted && 'hover:bg-muted/60'
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
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onOpenComments}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {post.comment_count || 0}
        </Button>
      </div>
    </motion.div>
  );
});
