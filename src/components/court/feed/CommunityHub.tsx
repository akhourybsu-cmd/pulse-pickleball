import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "./PostCard";
import { PostComposerInline } from "./PostComposerInline";
import { toast } from "sonner";
import { MessageSquare, Users, Sparkles } from "lucide-react";

interface CommunityHubProps {
  courtId: string;
  currentUserId: string | null;
}

export const CommunityHub = ({ courtId, currentUserId }: CommunityHubProps) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("feed");

  useEffect(() => {
    fetchPosts();
    const cleanup = subscribeToChanges();
    return cleanup;
  }, [courtId]);

  const fetchPosts = async () => {
    try {
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
          type,
          pinned,
          last_activity_at,
          lfg_format,
          expires_at,
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
        .order("pinned", { ascending: false })
        .order("last_activity_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Fetch reactions and comments count
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

      const mappedPosts = (data || []).map((post: any) => {
        // Determine type - use DB type or infer from data
        const hasSessionInfo = post.session_date && post.session_time && post.max_players && post.max_players > 0;
        const postType = post.type || (hasSessionInfo ? 'lfg' : 'feed');
        
        const commentCount = commentsData.data?.filter((c: any) => c.post_id === post.id).length || 0;
        const postReactions = reactionsData.data?.filter((r: any) => r.post_id === post.id) || [];
        
        return {
          ...post,
          type: postType,
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
      .channel(`community_hub_${courtId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "court_posts",
          filter: `court_id=eq.${courtId}`,
        } as any,
        () => fetchPosts()
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
      const { data: existing } = await supabase
        .from("court_post_reactions")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from("court_post_reactions").delete().eq("id", existing.id);
        toast.success("Reaction removed");
      } else {
        await supabase.from("court_post_reactions").insert({
          post_id: postId,
          user_id: currentUserId,
          emoji,
        });
        toast.success("Reaction added!");
      }
      
      fetchPosts();
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      toast.error("Failed to react to post");
    }
  };

  // Filter posts by active tab
  const filteredPosts = posts.filter(post => {
    if (activeTab === "feed") {
      return post.type === 'feed' || post.type === 'announcement' || post.type === 'general';
    }
    if (activeTab === "lfg") {
      return post.type === 'lfg';
    }
    if (activeTab === "highlights") {
      return post.type === 'highlight';
    }
    return true;
  });

  // Get empty state message based on tab
  const getEmptyStateMessage = () => {
    switch (activeTab) {
      case "feed":
        return "No posts yet — be the first to start the conversation at this court.";
      case "lfg":
        return "No active LFG posts — create one to find players fast.";
      case "highlights":
        return "No highlights yet — share a great moment.";
      default:
        return "No posts yet.";
    }
  };

  // Get placeholder text based on tab
  const getPlaceholder = () => {
    switch (activeTab) {
      case "feed":
        return "Post an update for this court...";
      case "lfg":
        return "Looking for players? Post here...";
      case "highlights":
        return "Share a great rally or moment...";
      default:
        return "Start a post...";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading community...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sticky top-0 z-10 bg-background">
          <TabsTrigger value="feed" className="flex-1 gap-1.5">
            <MessageSquare className="w-4 h-4" />
            <span>Feed</span>
          </TabsTrigger>
          <TabsTrigger value="lfg" className="flex-1 gap-1.5">
            <Users className="w-4 h-4" />
            <span>LFG</span>
          </TabsTrigger>
          <TabsTrigger value="highlights" className="flex-1 gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Highlights</span>
          </TabsTrigger>
        </TabsList>

        {/* Post Composer - Always visible under tabs */}
        <div className="pt-4">
          <PostComposerInline
            courtId={courtId}
            currentUserId={currentUserId}
            currentTab={activeTab}
            placeholder={getPlaceholder()}
            onPostCreated={fetchPosts}
          />
        </div>

        {/* Posts List - shared across tabs, filtered by type */}
        <div className="space-y-3 pt-4">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {getEmptyStateMessage()}
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId || undefined}
                onCommentClick={() => navigate(`/court/feed/${post.id}`)}
                onReactionClick={(emoji) => handleReaction(post.id, emoji)}
                onDelete={fetchPosts}
                onJoinSession={fetchPosts}
              />
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
};