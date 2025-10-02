import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Calendar, Clock, Trash2 } from "lucide-react";
import { formatDateEST, formatTime12Hour } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Court {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
}

interface Participant {
  id: string;
  user_id: string;
  joined_at: string;
  profiles: {
    full_name: string;
    current_rating: number;
  };
}

interface Post {
  id: string;
  title: string;
  content: string;
  session_date: string;
  session_time: string;
  max_players: number;
  status: string;
  created_at: string;
  user_id: string;
  court_id: string;
  profiles: {
    full_name: string;
    current_rating: number;
  };
  court_post_participants: Participant[];
}

const CourtBoard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // New session form
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("18:00");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [submitting, setSubmitting] = useState(false);
  
  // Join session state
  const [joinComment, setJoinComment] = useState<{[key: string]: string}>({});

  useEffect(() => {
    checkUser();
    fetchCourts();
  }, []);

  useEffect(() => {
    if (selectedCourtId) {
      fetchPosts();
    }
  }, [selectedCourtId]);

  // Update viewed participants count for organizer's posts
  useEffect(() => {
    if (!currentUserId) return;

    const updateViewedCount = async () => {
      const { data: userPosts } = await supabase
        .from("court_posts")
        .select(`
          id,
          court_post_participants(count)
        `)
        .eq("user_id", currentUserId)
        .eq("status", "open");

      if (userPosts) {
        for (const post of userPosts as any[]) {
          const currentCount = post.court_post_participants[0]?.count || 0;
          await supabase
            .from("court_posts")
            .update({ viewed_participants_count: currentCount })
            .eq("id", post.id);
        }
      }
    };

    updateViewedCount();
  }, [currentUserId, posts]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchCourts = async () => {
    const { data, error } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load courts",
        variant: "destructive",
      });
    } else if (data) {
      setCourts(data);
      if (data.length > 0) {
        setSelectedCourtId(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchPosts = async () => {
    setLoading(true);
    // Type assertion needed until types are regenerated after migration
    const { data, error } = await (supabase as any)
      .from("court_posts")
      .select(`
        *,
        profiles!court_posts_user_id_fkey(full_name, current_rating),
        court_post_participants(
          *,
          profiles!court_post_participants_user_id_fkey(full_name, current_rating)
        )
      `)
      .eq("court_id", selectedCourtId)
      .eq("status", "open")
      .order("session_date", { ascending: true })
      .order("session_time", { ascending: true });

    if (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      });
    } else {
      setPosts((data as any) || []);
    }
    setLoading(false);
  };

  const handleCreatePost = async () => {
    if (!currentUserId) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a session",
        variant: "destructive",
      });
      return;
    }

    if (!newPostTitle.trim() || !sessionDate || !sessionTime) {
      toast({
        title: "Missing information",
        description: "Please provide title, date, and time",
        variant: "destructive",
      });
      return;
    }

    const playersCount = parseInt(maxPlayers);
    if (isNaN(playersCount) || playersCount < 2 || playersCount > 20) {
      toast({
        title: "Invalid player count",
        description: "Please enter a number between 2 and 20",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    // Create the post
    const { data: newPost, error: postError } = await supabase
      .from("court_posts")
      .insert({
        court_id: selectedCourtId,
        user_id: currentUserId,
        title: newPostTitle,
        content: newPostContent,
        session_date: sessionDate,
        session_time: sessionTime,
        max_players: playersCount,
        status: "open",
      })
      .select()
      .single();

    if (postError || !newPost) {
      setSubmitting(false);
      console.error("Error creating post:", postError);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      });
      return;
    }

    // Automatically add the creator as a participant
    const { error: participantError } = await (supabase as any)
      .from("court_post_participants")
      .insert({
        post_id: newPost.id,
        user_id: currentUserId,
      });

    setSubmitting(false);

    if (participantError) {
      console.error("Error adding participant:", participantError);
      toast({
        title: "Warning",
        description: "Session created but couldn't add you as participant",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Session created successfully",
      });
      setNewPostTitle("");
      setNewPostContent("");
      setSessionDate("");
      setSessionTime("18:00");
      setMaxPlayers("4");
      setShowNewPost(false);
      fetchPosts();
    }
  };

  const handleJoinSession = async (postId: string) => {
    if (!currentUserId) {
      toast({
        title: "Authentication required",
        description: "Please log in to join",
        variant: "destructive",
      });
      return;
    }

    const comment = joinComment[postId] || null;

    const { error } = await (supabase as any)
      .from("court_post_participants")
      .insert({
        post_id: postId,
        user_id: currentUserId,
        comment: comment,
      });

    if (error) {
      console.error("Error joining session:", error);
      toast({
        title: "Error",
        description: "Failed to join session",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "You've joined the session!",
      });
      setJoinComment(prev => {
        const newState = {...prev};
        delete newState[postId];
        return newState;
      });
      fetchPosts();
    }
  };

  const handleLeaveSession = async (postId: string) => {
    if (!currentUserId) return;

    const { error } = await (supabase as any)
      .from("court_post_participants")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Error leaving session:", error);
      toast({
        title: "Error",
        description: "Failed to leave session",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "You've left the session",
      });
      fetchPosts();
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from("court_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
      fetchPosts();
    }
  };

  const selectedCourt = courts.find(c => c.id === selectedCourtId);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Court Connector</h1>
          <p className="text-muted-foreground">Find players at your favorite courts</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="court-select">Select Court</Label>
              <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
                <SelectTrigger id="court-select">
                  <SelectValue placeholder="Choose a court" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={court.id}>
                      {court.name} - {court.city}, {court.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => setShowNewPost(!showNewPost)}>
                {showNewPost ? "Cancel" : "Create Session"}
              </Button>
            </div>
          </div>

          {showNewPost && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="Looking for players..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="session-date">Date</Label>
                    <Input
                      id="session-date"
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="session-time">Time</Label>
                    <Input
                      id="session-time"
                      type="time"
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-players">Max Players</Label>
                    <Input
                      id="max-players"
                      type="number"
                      min="2"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="post-content">Additional Details (Optional)</Label>
                  <Textarea
                    id="post-content"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Any additional info about the session..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleCreatePost} disabled={submitting}>
                  {submitting ? "Creating..." : "Create Session"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading sessions...</div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                No open sessions for {selectedCourt?.name}. Create one to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const participants = post.court_post_participants || [];
              const isFull = participants.length >= post.max_players;
              const isParticipant = participants.some(p => p.user_id === currentUserId);
              const isCreator = post.user_id === currentUserId;

              return (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{post.title}</CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDateEST(post.session_date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime12Hour(post.session_time)}
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                        isFull ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      }`}>
                        <Users className="w-4 h-4" />
                        {participants.length}/{post.max_players}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {post.content && (
                      <p className="text-sm text-muted-foreground">{post.content}</p>
                    )}

                    <div className="space-y-2 pt-2 border-t">
                      <div className="text-sm font-medium">Players:</div>
                      <div className="space-y-2">
                        {participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="p-2 rounded-lg bg-muted/50 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{participant.profiles.full_name}</span>
                                <span className="text-primary font-semibold">
                                  ({participant.profiles.current_rating?.toFixed(2) || '3.00'})
                                </span>
                                {participant.user_id === post.user_id && (
                                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    Organizer
                                  </span>
                                )}
                              </div>
                            </div>
                            {(participant as any).comment && (
                              <p className="text-sm text-muted-foreground italic">
                                "{(participant as any).comment}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      {!currentUserId ? (
                        <p className="text-sm text-muted-foreground">Log in to join this session</p>
                      ) : isParticipant ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleLeaveSession(post.id)}
                            className="flex-1"
                          >
                            Leave Session
                          </Button>
                          {isCreator && (
                            <Button
                              variant="destructive"
                              onClick={() => handleDeletePost(post.id)}
                              size="icon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ) : isFull ? (
                        <Button variant="outline" disabled className="w-full">
                          Session Full
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Add an optional comment (e.g., 'Bringing extra balls!')"
                            value={joinComment[post.id] || ""}
                            onChange={(e) => setJoinComment(prev => ({...prev, [post.id]: e.target.value}))}
                            rows={2}
                          />
                          <Button
                            onClick={() => handleJoinSession(post.id)}
                            className="w-full"
                          >
                            Join Session
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourtBoard;
