import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ThumbsUp, Heart, Laugh, Sparkles, Calendar, Clock, Users, Trash2, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PostCardProps {
  post: {
    id: string;
    user_id: string;
    type?: string;
    title: string;
    body: string;
    content?: string;
    status: string;
    created_at: string;
    user: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
    _count?: {
      comments: number;
      reactions: number;
    };
    reactions?: Array<{
      emoji: string;
      count: number;
    }>;
    metadata?: {
      session_date?: string;
      session_time?: string;
      max_players?: number;
    };
  };
  onCommentClick: () => void;
  onReactionClick: (emoji: string) => void;
  currentUserId?: string;
  onDelete?: () => void;
}

const POST_TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  lfg: { label: "Looking for Game", icon: Users },
  announcement: { label: "Announcement", icon: Sparkles },
  general: { label: "Discussion", icon: MessageSquare },
  highlight: { label: "Highlight", icon: Sparkles },
};

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  open: { label: "Open", variant: "default" },
  filled: { label: "Filled", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

export const PostCard = ({ post, onCommentClick, onReactionClick, currentUserId, onDelete }: PostCardProps) => {
  const navigate = useNavigate();
  const [showFullBody, setShowFullBody] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const postType = post.type || 'lfg';
  const postBody = post.body || post.content || '';
  
  const typeInfo = POST_TYPE_LABELS[postType] || POST_TYPE_LABELS.general;
  const statusInfo = STATUS_LABELS[post.status] || STATUS_LABELS.open;

  const truncatedBody = postBody?.length > 150 
    ? postBody.substring(0, 150) + "..." 
    : postBody;

  const isAuthor = currentUserId && post.user_id === currentUserId;

  const reactionEmojis = [
    { emoji: "👍", icon: ThumbsUp },
    { emoji: "❤️", icon: Heart },
    { emoji: "😂", icon: Laugh },
  ];

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("court_posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Post deleted successfully");
      setShowDeleteDialog(false);
      onDelete?.();
    } catch (error: any) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => navigate(`/court/feed/${post.id}`)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={post.user.avatar_url || undefined} />
                <AvatarFallback>{post.user.display_name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{post.user.display_name || "Anonymous"}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <typeInfo.icon className="w-3 h-3" />
                    {typeInfo.label}
                  </Badge>
                  <Badge variant={statusInfo.variant as any} className="text-xs">
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
            
            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <h3 className="font-bold text-lg mb-2">{post.title}</h3>
          
          <div className="text-sm text-muted-foreground mb-3">
            {showFullBody ? postBody : truncatedBody}
            {postBody?.length > 150 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullBody(!showFullBody);
                }}
                className="text-primary ml-1 hover:underline"
              >
                {showFullBody ? "See less" : "See more"}
              </button>
            )}
          </div>

          {/* LFG Session Info */}
          {post.type === 'lfg' && post.metadata && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 p-2 bg-muted/50 rounded-md">
              {post.metadata.session_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {post.metadata.session_date}
                </div>
              )}
              {post.metadata.session_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {post.metadata.session_time}
                </div>
              )}
              {post.metadata.max_players && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {post.metadata.max_players} players
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCommentClick();
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{post._count?.comments || 0}</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {reactionEmojis.map(({ emoji, icon: Icon }) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReactionClick(emoji);
                  }}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              ))}
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
