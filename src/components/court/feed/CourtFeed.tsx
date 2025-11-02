import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { toast } from "sonner";

interface CourtFeedProps {
  courtId: string;
}

export const CourtFeed = ({ courtId }: CourtFeedProps) => {
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
      // Fetch posts using current schema
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
            avatar_url
          )
        `)
        .eq("court_id", courtId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        throw error;
      }

      // Map posts and infer type from existing data
      let mappedPosts = (data || []).map((post: any) => {
        // Determine post type based on existing data
        const hasSessionInfo = post.session_date && post.session_time;
        const inferredType = hasSessionInfo ? 'lfg' : 'general';
        
        return {
          ...post,
          type: inferredType,
          body: post.content || '',
          metadata: hasSessionInfo ? {
            session_date: post.session_date,
            session_time: post.session_time,
            max_players: post.max_players,
          } : {},
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      toast.info("Reactions coming soon!");
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
        onClick={() => setComposerOpen(true)}
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
              post={{
                ...post,
                _count: { comments: 0, reactions: 0 },
                reactions: [],
              }}
              onCommentClick={() => {
                toast.info("Comments coming soon!");
              }}
              onReactionClick={(emoji) => handleReaction(post.id, emoji)}
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