import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { toast } from "sonner";

interface CourtFeedProps {
  courtId: string;
  currentUserId: string | null;
}

export const CourtFeed = ({ courtId, currentUserId }: CourtFeedProps) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchPosts();
    const cleanup = subscribeToChanges();
    return cleanup;
  }, [courtId, filter]);

  const fetchPosts = async () => {
    try {
      // Fetch posts using current schema with participants and reactions
      const { data, error } = await supabase
        .from("court_posts")
        .select(`
          id,
          court_id,
          user_id,
          title,
          content,
          status,
          session_date,
          session_time,
          max_players,
          created_at,
          updated_at,
          viewed_participants_count,
          user:profiles!court_posts_user_id_fkey (
            id,
            display_name,
            avatar_url,
            current_rating
          ),
          participants:court_post_participants(
            id,
            user_id,
            joined_at,
            user:profiles!court_post_participants_user_id_fkey(
              id,
              display_name,
              avatar_url,
              current_rating
            )
          )
        `)
        .eq("court_id", courtId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        throw error;
      }

      // Fetch reactions and comments count separately
      const postIds = (data || []).map((p: any) => p.id);
      
      const [reactionsData, commentsData] = await Promise.all([
        supabase
          .from("court_post_reactions")
          .select("post_id, emoji, user_id")
          .in("post_id", postIds),
        supabase
          .from("court_post_comments")
          .select("post_id, id")
          .in("post_id", postIds)
          .is("parent_comment_id", null)
      ]);

      // Map posts and infer type from existing data
      let mappedPosts = (data || []).map((post: any) => {
        // Determine post type based on existing data
        // max_players of 0 or null indicates non-LFG post
        const hasSessionInfo = post.session_date && post.session_time && post.max_players > 0;
        const inferredType = hasSessionInfo ? 'lfg' : 'general';
        
        // Count comments for this post
        const commentCount = commentsData.data?.filter((c: any) => c.post_id === post.id).length || 0;
        
        // Get reactions for this post
        const postReactions = reactionsData.data?.filter((r: any) => r.post_id === post.id) || [];
        
        return {
          ...post,
          type: inferredType,
          body: post.content || '',
          metadata: hasSessionInfo ? {
            session_date: post.session_date,
            session_time: post.session_time,
            max_players: post.max_players,
          } : {},
          _count: {
            comments: commentCount,
            reactions: postReactions.length,
          },
          reactions: postReactions,
        };
      });

      // Apply client-side filter if needed
      if (filter !== "all") {
        mappedPosts = mappedPosts.filter(post => post.type === filter);
      }

      setPosts(mappedPosts);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel(`court_feed_${courtId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "court_posts",
          filter: `court_id=eq.${courtId}`,
        } as any,
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleReaction = async (postId: string, emoji: string) => {
    if (!currentUserId) {
      toast.error("Please sign up to react to posts", {
        action: {
          label: "Join Pulse",
          onClick: () => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`),
        },
      });
      return;
    }

    try {
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
      
      fetchPosts(); // Refresh to show updated reactions
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      toast.error("Failed to react to post");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading feed...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Composer Trigger */}
      <Button
        onClick={() => {
          if (!currentUserId) {
            toast.error("Please sign up to post to the feed", {
              action: {
                label: "Join Pulse",
                onClick: () => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`),
              },
            });
            return;
          }
          setComposerOpen(true);
        }}
        className="w-full justify-start text-muted-foreground bg-muted hover:bg-muted/80"
        variant="outline"
      >
        <Plus className="w-4 h-4 mr-2" />
        Start a post...
      </Button>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="lfg" className="flex-1">LFG</TabsTrigger>
          <TabsTrigger value="general" className="flex-1">Discussion</TabsTrigger>
          <TabsTrigger value="highlight" className="flex-1">Highlights</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Posts List */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No posts yet. Be the first to start a conversation!
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId || undefined}
              onCommentClick={() => {
                navigate(`/court/feed/${post.id}`);
              }}
              onReactionClick={(emoji) => handleReaction(post.id, emoji)}
              onDelete={fetchPosts}
              onJoinSession={fetchPosts}
            />
          ))
        )}
      </div>

      {/* Post Composer Modal */}
      <PostComposer
        courtId={courtId}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onPostCreated={fetchPosts}
      />
    </div>
  );
};