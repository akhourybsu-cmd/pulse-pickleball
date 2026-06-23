import { useEffect, useRef, useState } from 'react';
import { Trash2, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGroupPostComments, type PostComment } from '@/hooks/useGroupPostComments';
import { cn } from '@/lib/utils';
import { MessageComposer, type MessageComposerHandle } from './MessageComposer';

interface PostCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  currentUserId: string | null;
  isAdmin: boolean;
}

const nameOf = (c?: PostComment | null) =>
  c?.profile?.display_name || c?.profile?.full_name || 'Member';

const initialsOf = (c?: PostComment | null) =>
  nameOf(c)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export function PostCommentsSheet({
  open,
  onOpenChange,
  postId,
  currentUserId,
  isAdmin,
}: PostCommentsSheetProps) {
  const { comments, loading, creating, createComment, deleteComment, totalCount } =
    useGroupPostComments(postId);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const composerRef = useRef<MessageComposerHandle>(null);

  // Reset on close so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setDraft('');
      setReplyTo(null);
    }
  }, [open]);

  const handleReply = (c: PostComment) => {
    setReplyTo(c);
    composerRef.current?.focus();
  };

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || creating) return;
    setDraft('');
    const parentId = replyTo?.parent_comment_id || replyTo?.id;
    setReplyTo(null);
    await createComment(content, parentId || undefined);
  };

  const renderComment = (comment: PostComment, isReply = false) => {
    const isOwn = comment.user_id === currentUserId;
    const canDelete = isOwn || isAdmin;
    const name = nameOf(comment);

    return (
      <div key={comment.id} className={cn('flex gap-3', isReply && 'ml-10')}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initialsOf(comment)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-muted px-3 py-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{name}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          </div>
          <div className="flex items-center gap-1 mt-1 ml-1">
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleReply(comment)}
              >
                Reply
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => deleteComment(comment.id)}
                aria-label="Delete comment"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Nested replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="space-y-3 mt-3">
              {comment.replies.map((reply) => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Lock the sheet to the bottom of the viewport and use the small-viewport
        // height unit so the on-screen keyboard doesn't push it around.
        className="h-[85svh] max-h-[85svh] flex flex-col p-0 gap-0 rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Comments
            <span className="text-muted-foreground font-normal">({totalCount})</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-base font-semibold mb-1">No comments yet</h3>
                <p className="text-sm text-muted-foreground">Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-5">
                {comments.map((comment) => renderComment(comment))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Shared composer: anchored, safe-area aware, reply pill, Enter sends */}
        <MessageComposer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          sending={creating}
          placeholder={replyTo ? `Reply to ${nameOf(replyTo)}…` : 'Write a comment…'}
          replyToLabel={replyTo ? nameOf(replyTo) : null}
          onCancelReply={() => setReplyTo(null)}
          sendLabel="Send comment"
        />
      </SheetContent>
    </Sheet>
  );
}
