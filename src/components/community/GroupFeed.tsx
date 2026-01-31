import { useState, useCallback } from 'react';
import { MessageSquare, Pin, Trash2, MoreVertical, Send, Image, PenSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { PostCommentsSheet } from './PostCommentsSheet';
import { GroupEmptyState } from './GroupEmptyState';
import { GroupWelcomeCard } from './GroupWelcomeCard';
import { GroupFeedPlaceholder } from './GroupFeedPlaceholder';
import { CommunityPulse } from './CommunityPulse';
import { ComposerQuickActions } from './ComposerQuickActions';
import { formatDistanceToNow } from 'date-fns';
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

const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🎾', label: 'Tennis' },
  { emoji: '🔥', label: 'Fire' },
];

export function GroupFeed({ 
  groupId, 
  groupName = 'this group',
  isAdmin, 
  currentUserId,
  onOpenQuickPost,
  onSwitchToEvents,
}: GroupFeedProps) {
  const { posts, loading, createPost, deletePost, toggleReaction, togglePin } = useGroupPosts(groupId);
  const { events } = useGroupEvents(groupId);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [deleteDialogPost, setDeleteDialogPost] = useState<GroupPost | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const pinnedPosts = posts.filter(p => p.pinned);
  const regularPosts = posts.filter(p => !p.pinned);

  return (
    <div className="space-y-5">
      {/* Enhanced Post Composer */}
      <motion.div 
        className={cn(
          'rounded-xl p-4 transition-all duration-200',
          'bg-gradient-to-br from-muted/40 to-muted/20',
          'shadow-sm border border-border/20',
          composerFocused && 'ring-2 ring-primary/20 border-primary/30'
        )}
        animate={composerFocused ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex gap-3 items-start">
          <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-background">
            <AvatarFallback className="text-sm bg-primary/10 text-primary">U</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="relative">
              <Textarea
                placeholder="Share something with the group..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                className={cn(
                  'min-h-[56px] resize-none pr-20 text-sm py-3 px-3.5 rounded-xl',
                  'bg-background border-border/30',
                  'focus:ring-0 focus:border-border/50 transition-colors'
                )}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                  <Image className="h-3.5 w-3.5 text-muted-foreground/50" />
                </Button>
                <Button 
                  onClick={handleCreatePost} 
                  disabled={!newPostContent.trim() || isPosting}
                  size="sm"
                  className="h-7 px-3 text-xs rounded-lg"
                >
                  Post
                </Button>
              </div>
            </div>
            
            {/* Quick Action Chips */}
            <ComposerQuickActions
              className="mt-3"
              onPhotoClick={focusComposer}
              onEventClick={() => onSwitchToEvents?.()}
              onPollClick={() => onOpenQuickPost?.('poll')}
              onQuestionClick={focusComposer}
            />
          </div>
        </div>
      </motion.div>

      {/* Community Pulse - Activity Stats */}
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
          {pinnedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={() => setDeleteDialogPost(post)}
              onToggleReaction={toggleReaction}
              onTogglePin={togglePin}
              onOpenComments={() => setCommentsPostId(post.id)}
            />
          ))}
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
        <div className="space-y-3">
          {regularPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={() => setDeleteDialogPost(post)}
              onToggleReaction={toggleReaction}
              onTogglePin={togglePin}
              onOpenComments={() => setCommentsPostId(post.id)}
            />
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
    </div>
  );
}

// Extracted PostCard component for cleaner code
interface PostCardProps {
  post: GroupPost;
  currentUserId: string | null;
  isAdmin: boolean;
  onDelete: () => void;
  onToggleReaction: (postId: string, emoji: string) => void;
  onTogglePin: (postId: string, pinned: boolean) => void;
  onOpenComments: () => void;
}

function PostCard({
  post,
  currentUserId,
  isAdmin,
  onDelete,
  onToggleReaction,
  onTogglePin,
  onOpenComments,
}: PostCardProps) {
  const typeInfo = POST_TYPE_BADGES[post.type] || POST_TYPE_BADGES.feed;
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
        post.pinned ? 'border-primary/20 bg-primary/5' : 'border-border/20'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {post.profile?.display_name || post.profile?.full_name || 'Unknown'}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
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
      </div>

      {/* Footer */}
      <div className="pt-2 flex items-center justify-between border-t border-border/15">
        <div className="flex items-center gap-1">
          {REACTION_EMOJIS.map(({ emoji }) => {
            const reactionData = post.reactions?.find(r => r.emoji === emoji);
            const hasReacted = reactionData?.user_reacted;
            const count = reactionData?.count || 0;

            return (
              <Button
                key={emoji}
                variant={hasReacted ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('h-7 gap-1 px-2 text-xs', hasReacted && 'bg-primary/10')}
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
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={onOpenComments}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {post.comment_count || 0}
        </Button>
      </div>
    </motion.div>
  );
}
