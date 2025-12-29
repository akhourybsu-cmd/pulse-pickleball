import { useState } from 'react';
import { MessageSquare, Pin, Trash2, MoreVertical, ThumbsUp, Heart, Sparkles, Send, Image } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
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
      {/* Post Composer */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="Share an update with the group..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="gap-2" disabled>
                  <Image className="h-4 w-4" />
                  Photo
                </Button>
                <Button 
                  onClick={handleCreatePost} 
                  disabled={!newPostContent.trim() || isPosting}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Be the first to share an update with the group!
            </p>
          </CardContent>
        </Card>
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
            <Card key={post.id} className={cn(post.pinned && 'border-primary/50 bg-primary/5')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={post.profile?.avatar_url || undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {post.profile?.display_name || post.profile?.full_name || 'Unknown'}
                        </span>
                        {post.profile?.current_rating && (
                          <Badge variant="outline" className="text-xs h-5">
                            {post.profile.current_rating.toFixed(2)}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {post.pinned && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </Badge>
                        )}
                        {post.type !== 'feed' && (
                          <Badge variant="outline" className={cn('text-xs', typeInfo.className)}>
                            {typeInfo.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
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
              </CardHeader>

              <CardContent className="pb-3">
                {post.title && (
                  <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                )}
                {post.content && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}
              </CardContent>

              <CardFooter className="pt-0 flex items-center justify-between">
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
                        className={cn('h-8 gap-1 px-2', hasReacted && 'bg-primary/10')}
                        onClick={() => toggleReaction(post.id, emoji)}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span className="text-xs">{count}</span>}
                      </Button>
                    );
                  })}
                </div>

                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  {post.comment_count || 0}
                </Button>
              </CardFooter>
            </Card>
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
    </div>
  );
}
