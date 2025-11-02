import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ThumbsUp, Flame, Laugh, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: {
    id: string;
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
  };
  onCommentClick: () => void;
  onReactionClick: (emoji: string) => void;
}

const POST_TYPE_LABELS: Record<string, { label: string; variant: any }> = {
  lfg: { label: "Looking for Game", variant: "default" },
  announcement: { label: "Announcement", variant: "secondary" },
  general: { label: "Discussion", variant: "outline" },
  highlight: { label: "Highlight", variant: "default" },
  archive: { label: "Archive", variant: "outline" },
};

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  open: { label: "Open", variant: "default" },
  filled: { label: "Filled", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

export const PostCard = ({ post, onCommentClick, onReactionClick }: PostCardProps) => {
  const navigate = useNavigate();
  const [showFullBody, setShowFullBody] = useState(false);

  const postType = post.type || 'lfg';
  const postBody = post.body || post.content || '';
  
  const typeInfo = POST_TYPE_LABELS[postType] || POST_TYPE_LABELS.general;
  const statusInfo = STATUS_LABELS[post.status] || STATUS_LABELS.open;

  const truncatedBody = postBody?.length > 150 
    ? postBody.substring(0, 150) + "..." 
    : postBody;

  const reactionEmojis = [
    { emoji: "👍", icon: ThumbsUp },
    { emoji: "🔥", icon: Flame },
    { emoji: "😂", icon: Laugh },
    { emoji: "❤️", icon: Heart },
  ];

  return (
    <Card 
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/court/feed/${post.id}`)}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.user.avatar_url || undefined} />
          <AvatarFallback>
            {post.user.display_name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{post.user.display_name}</span>
            <Badge variant={typeInfo.variant} className="text-xs">
              {typeInfo.label}
            </Badge>
            {post.type === "lfg" && (
              <Badge variant={statusInfo.variant} className="text-xs">
                {statusInfo.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-bold text-lg mb-2">{post.title}</h3>

      {/* Body */}
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-4">
          {/* Reactions Summary */}
          <div className="flex items-center gap-1">
            {post.reactions?.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReactionClick(reaction.emoji);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-xs"
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>

          {/* Comment Count */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCommentClick();
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{post._count?.comments || 0} comments</span>
          </button>
        </div>

        {/* Quick Reactions */}
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
    </Card>
  );
};