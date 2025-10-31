import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Clock, TrendingUp, MessageSquare } from "lucide-react";
import { formatDateEST, formatTime12Hour } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface LFGPost {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  format: string;
  capacity: number;
  intensity: string;
  notes: string;
  status: string;
  profiles?: {
    full_name: string;
    display_name: string | null;
    current_rating: number;
  };
  lfg_rsvps: {
    user_id: string;
    status: string;
    profiles?: {
      full_name: string;
      display_name: string | null;
      current_rating: number;
    };
  }[];
}

interface LFGListProps {
  courtId: string;
  userId: string | null;
}

export function LFGList({ courtId, userId }: LFGListProps) {
  const [posts, setPosts] = useState<LFGPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPosts();
    subscribeToUpdates();
  }, [courtId]);

  const fetchPosts = async () => {
    const { data } = await (supabase as any)
      .from("lfg_posts")
      .select(`
        *,
        profiles:created_by (full_name, display_name, current_rating),
        lfg_rsvps (
          user_id,
          status,
          profiles:user_id (full_name, display_name, current_rating)
        )
      `)
      .eq("court_id", courtId)
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (data) {
      setPosts(data as any);
    }
    setLoading(false);
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`lfg_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lfg_posts',
          filter: `court_id=eq.${courtId}`,
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRSVP = async (postId: string, status: 'yes' | 'maybe' | 'waitlist') => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to RSVP",
        variant: "destructive",
      });
      return;
    }

    const { error } = await (supabase as any)
      .from("lfg_rsvps")
      .upsert({
        lfg_id: postId,
        user_id: userId,
        status,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update RSVP",
        variant: "destructive",
      });
    } else {
      toast({
        title: "RSVP Updated",
        description: `You're ${status === 'yes' ? 'confirmed' : status === 'maybe' ? 'marked as maybe' : 'on the waitlist'}`,
      });
      fetchPosts();
    }
  };

  const handleLeave = async (postId: string) => {
    if (!userId) return;

    const { error } = await (supabase as any)
      .from("lfg_rsvps")
      .delete()
      .eq("lfg_id", postId)
      .eq("user_id", userId);

    if (!error) {
      toast({
        title: "Left Session",
        description: "You've been removed from this LFG",
      });
      fetchPosts();
    }
  };

  const getUserRSVP = (post: LFGPost) => {
    return post.lfg_rsvps?.find(r => r.user_id === userId);
  };

  const getConfirmedCount = (post: LFGPost) => {
    return post.lfg_rsvps?.filter(r => r.status === 'yes').length || 0;
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No active LFG posts. Be the first to create one!
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {posts.map((post) => {
        const userRSVP = getUserRSVP(post);
        const confirmed = getConfirmedCount(post);
        const isFull = confirmed >= post.capacity;

        return (
          <Card key={post.id} className="overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg break-words">{post.title}</CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">
                    {formatDateEST(new Date(post.starts_at), "EEE, MMM d")} • {formatTime12Hour(new Date(post.starts_at).toTimeString().slice(0, 5))}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-0.5">
                    <Badge variant="outline" className="capitalize text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">{post.intensity}</Badge>
                    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">{post.format}</Badge>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      by {post.profiles?.display_name || post.profiles?.full_name || "Unknown"}
                      {post.profiles?.current_rating && (
                        <span className="ml-1 font-semibold">({post.profiles.current_rating.toFixed(2)})</span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant={isFull ? "secondary" : "default"} className="flex-shrink-0 text-[10px] sm:text-xs">
                  {confirmed}/{post.capacity}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6 pb-3 sm:pb-4">

              {post.notes && (
                <p className="text-xs sm:text-sm text-muted-foreground break-words">{post.notes}</p>
              )}

              {post.lfg_rsvps && post.lfg_rsvps.filter(r => r.status === 'yes').length > 0 && (
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground">Confirmed Players:</p>
                  <div className="space-y-1 sm:space-y-1.5">
                    {post.lfg_rsvps.filter(r => r.status === 'yes').map((rsvp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                        <span className="font-medium truncate flex-1">{rsvp.profiles?.display_name || rsvp.profiles?.full_name || "Unknown"}</span>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs font-semibold flex-shrink-0">
                          {rsvp.profiles?.current_rating ? rsvp.profiles.current_rating.toFixed(2) : 'N/A'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {userRSVP ? (
                  <>
                    <Badge variant={userRSVP.status === 'yes' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                      {userRSVP.status === 'yes' ? 'Confirmed' : userRSVP.status === 'maybe' ? 'Maybe' : 'Waitlist'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => handleLeave(post.id)} className="text-xs h-7 sm:h-8">
                      Leave
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleRSVP(post.id, 'yes')}
                      disabled={isFull}
                      className="text-xs h-7 sm:h-8"
                    >
                      {isFull ? 'Full' : 'I\'m In'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRSVP(post.id, 'maybe')}
                      className="text-xs h-7 sm:h-8"
                    >
                      Maybe
                    </Button>
                    {isFull && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRSVP(post.id, 'waitlist')}
                        className="text-xs h-7 sm:h-8"
                      >
                        Waitlist
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
