import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, MessageSquare, ThumbsUp, Flame, Laugh, Heart, Send, LogOut, User as UserIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import logo from "@/assets/pulse-logo-new.png";

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

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
    if (postId) {
      fetchPost();
      fetchComments();
      fetchReactions();
      subscribeToChanges();
    }
  }, [postId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from("court_posts")
        .select(`
          *,
          user:profiles!court_posts_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("id", postId)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error: any) {
      console.error("Error fetching post:", error);
      toast.error("Failed to load post");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error }: any = await (supabase as any)
        .from("court_post_comments")
        .select(`
          *,
          author:profiles!court_post_comments_author_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("post_id", postId)
        .is("parent_comment_id", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .from("court_post_reactions")
        .select("emoji, user_id")
        .eq("post_id", postId);

      if (error) throw error;
      setReactions(data || []);
    } catch (error: any) {
      console.error("Error fetching reactions:", error);
    }
  };

  const subscribeToChanges = () => {
    const commentsChannel = supabase
      .channel(`post_comments_${postId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "court_post_comments",
          filter: `post_id=eq.${postId}`,
        } as any,
        () => {
          fetchComments();
        }
      )
      .subscribe();

    const reactionsChannel = supabase
      .channel(`post_reactions_${postId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "court_post_reactions",
          filter: `post_id=eq.${postId}`,
        } as any,
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(reactionsChannel);
    };
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("court_post_comments")
        .insert({
          post_id: postId,
          author_user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      toast.success("Comment added!");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      if (!currentUserId) {
        toast.error("Please sign in to react");
        return;
      }

      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from("court_post_reactions")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        // Remove reaction
        await supabase
          .from("court_post_reactions")
          .delete()
          .eq("id", existing.id);
        toast.success("Reaction removed");
      } else {
        // Add reaction
        await supabase
          .from("court_post_reactions")
          .insert({
            post_id: postId,
            user_id: currentUserId,
            emoji,
          });
        toast.success("Reaction added!");
      }
      
      fetchReactions(); // Refresh reactions
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      toast.error("Failed to react");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!post) return null;

  const typeInfo = POST_TYPE_LABELS[post.type] || POST_TYPE_LABELS.general;
  const statusInfo = STATUS_LABELS[post.status] || STATUS_LABELS.open;

  const reactionEmojis = [
    { emoji: "👍", icon: ThumbsUp },
    { emoji: "🔥", icon: Flame },
    { emoji: "😂", icon: Laugh },
    { emoji: "❤️", icon: Heart },
  ];

  // Group reactions by emoji and count them
  const reactionCounts = reactions.reduce((acc: any, reaction: any) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/profile/${currentUserId}`)} 
              className="rounded-full h-[38px] w-[38px]"
            >
              <UserIcon className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">View Profile</span>
            </Button>
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={handleSignOut} className="h-[38px]">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>

        {/* Post Content */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={post.user.avatar_url || undefined} />
                <AvatarFallback>
                  {post.user.display_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold">{post.user.display_name}</span>
                  <Badge variant={typeInfo.variant} className="text-xs">
                    {typeInfo.label}
                  </Badge>
                  {post.type === "lfg" && (
                    <Badge variant={statusInfo.variant} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Title & Body */}
            <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
            <div className="text-base whitespace-pre-wrap mb-4">{post.content}</div>

            {/* LFG Metadata */}
            {post.type === "lfg" && post.metadata && (
              <div className="bg-muted p-4 rounded-lg mb-4 space-y-2">
                {post.metadata.session_date && (
                  <p className="text-sm">
                    <span className="font-semibold">Date:</span> {post.metadata.session_date}
                  </p>
                )}
                {post.metadata.session_time && (
                  <p className="text-sm">
                    <span className="font-semibold">Time:</span> {post.metadata.session_time}
                  </p>
                )}
                {post.metadata.max_players && (
                  <p className="text-sm">
                    <span className="font-semibold">Players Needed:</span> {post.metadata.max_players}
                  </p>
                )}
              </div>
            )}

            {/* Reactions */}
            <div className="pt-4 border-t">
              {/* Reaction Counts */}
              {Object.keys(reactionCounts).length > 0 && (
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  {Object.entries(reactionCounts).map(([emoji, count]: [string, any]) => (
                    <div key={emoji} className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="font-semibold">{count}</span>
                      <span>{emoji}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Reaction Buttons */}
              <div className="flex items-center gap-2">
                {reactionEmojis.map(({ emoji, icon: Icon }) => (
                  <Button
                    key={emoji}
                    variant="outline"
                    size="sm"
                    onClick={() => handleReaction(emoji)}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comments ({comments.length})
            </h2>

            {/* Comment List */}
            <div className="space-y-4 mb-6">
              {comments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author?.avatar_url || undefined} />
                      <AvatarFallback>
                        {comment.author?.display_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="font-semibold text-sm mb-1">
                          {comment.author?.display_name || "Unknown User"}
                        </p>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-3">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="sticky bottom-0 bg-background pt-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-[60px]"
                  disabled={!currentUserId}
                />
                <Button
                  type="submit"
                  disabled={!newComment.trim() || submitting || !currentUserId}
                  size="icon"
                  className="h-[60px] w-[60px]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}