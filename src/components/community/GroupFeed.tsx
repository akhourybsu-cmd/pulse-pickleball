import { useState } from 'react';
import { MessageSquare, Pin, Trash2, MoreVertical, Send, Image, BarChart3, Gamepad2, Calendar, PenSquare } from 'lucide-react';
import { PostCommentsSheet } from './PostCommentsSheet';
import { GroupEmptyState } from './GroupEmptyState';
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
import { cn } from '@/lib/utils';

interface GroupFeedProps {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string | null;
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

export function GroupFeed({ groupId, isAdmin, currentUserId }: GroupFeedProps) {
  const { posts, loading, createPost, deletePost, toggleReaction, togglePin } = useGroupPosts(groupId);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [deleteDialogPost, setDeleteDialogPost] = useState<GroupPost | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Post Composer */}
      <div className="bg-muted/30 rounded-xl p-3">
        <div className="flex gap-3 items-start">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs">U</AvatarFallback>
          </Avatar>
          <div className="flex-1 relative">
            <Textarea
              placeholder="Post to the group..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="min-h-[52px] resize-none pr-20 text-sm py-2.5 px-3 rounded-lg bg-background border-border/40"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                <Image className="h-3.5 w-3.5 text-muted-foreground/50" />
              </Button>
              <Button 
                onClick={handleCreatePost} 
                disabled={!newPostContent.trim() || isPosting}
                size="sm"
                className="h-7 px-3 text-xs"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <GroupEmptyState
          icon={MessageSquare}
          title="No posts yet"
          description="Be the first to share an update with the group!"
          actions={[
            { label: 'Post Update', onClick: () => document.querySelector('textarea')?.focus(), icon: PenSquare },
          ]}
        />
      ) : (
        posts.map((post) => {
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
            <div key={post.id} className={cn('p-4 rounded-xl bg-card border transition-colors', post.pinned ? 'border-primary/30 bg-primary/5' : 'border-border/30')}>
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
                      {post.pinned && (
                        <Badge variant="secondary" className="gap-1 text-[10px] h-5 px-1.5">
                          <Pin className="h-2.5 w-2.5" />
                          Pinned
                        </Badge>
                      )}
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
                        <DropdownMenuItem onClick={() => togglePin(post.id, !post.pinned)}>
                          <Pin className="h-4 w-4 mr-2" />
                          {post.pinned ? 'Unpin' : 'Pin Post'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => setDeleteDialogPost(post)}
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
              <div className="pt-2 flex items-center justify-between border-t border-border/20">
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
                        onClick={() => toggleReaction(post.id, emoji)}
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
                  onClick={() => setCommentsPostId(post.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {post.comment_count || 0}
                </Button>
              </div>
            </div>
          );
        })
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
