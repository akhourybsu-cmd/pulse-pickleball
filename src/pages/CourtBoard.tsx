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
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Court {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  court_id: string;
  profiles: {
    full_name: string;
    current_rating: number;
  };
  comments: Comment[];
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    current_rating: number;
  };
}

const CourtBoard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // New post form
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Comments
  const [commentContent, setCommentContent] = useState<{[key: string]: string}>({});
  const [commentingOn, setCommentingOn] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
    fetchCourts();
  }, []);

  useEffect(() => {
    if (selectedCourtId) {
      fetchPosts();
    }
  }, [selectedCourtId]);

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
    const { data, error } = await supabase
      .from("court_posts")
      .select(`
        *,
        profiles!court_posts_user_id_fkey(full_name, current_rating),
        court_post_comments(
          *,
          profiles!court_post_comments_user_id_fkey(full_name, current_rating)
        )
      `)
      .eq("court_id", selectedCourtId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } else {
      setPosts(data as any || []);
    }
    setLoading(false);
  };

  const handleCreatePost = async () => {
    if (!currentUserId) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a post",
        variant: "destructive",
      });
      return;
    }

    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a title and content",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("court_posts")
      .insert({
        court_id: selectedCourtId,
        user_id: currentUserId,
        title: newPostTitle,
        content: newPostContent,
      });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Post created successfully",
      });
      setNewPostTitle("");
      setNewPostContent("");
      setShowNewPost(false);
      fetchPosts();
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUserId) {
      toast({
        title: "Authentication required",
        description: "Please log in to comment",
        variant: "destructive",
      });
      return;
    }

    const content = commentContent[postId]?.trim();
    if (!content) return;

    const { error } = await supabase
      .from("court_post_comments")
      .insert({
        post_id: postId,
        user_id: currentUserId,
        content: content,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } else {
      setCommentContent({ ...commentContent, [postId]: "" });
      setCommentingOn(null);
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
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Looking For Group</h1>
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
                {showNewPost ? "Cancel" : "New Post"}
              </Button>
            </div>
          </div>

          {showNewPost && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Post</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="Looking for 2 more players..."
                  />
                </div>
                <div>
                  <Label htmlFor="post-content">Message</Label>
                  <Textarea
                    id="post-content"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="We're playing at 6pm today and need 2 more. All levels welcome!"
                    rows={4}
                  />
                </div>
                <Button onClick={handleCreatePost} disabled={submitting}>
                  {submitting ? "Posting..." : "Post"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading posts...</div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                No posts yet for {selectedCourt?.name}. Be the first to post!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <CardTitle className="text-xl">{post.title}</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Posted by <span className="font-medium">{post.profiles.full_name}</span> 
                    <span className="text-primary font-semibold"> ({post.profiles.current_rating.toFixed(2)})</span>
                    {" • "}
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap">{post.content}</p>

                  {post.comments && post.comments.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquare className="w-4 h-4" />
                        {post.comments.length} {post.comments.length === 1 ? "Comment" : "Comments"}
                      </div>
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="pl-4 border-l-2 space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">{comment.profiles.full_name}</span>
                            <span className="text-primary font-semibold"> ({comment.profiles.current_rating.toFixed(2)})</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    {commentingOn === post.id ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={commentContent[post.id] || ""}
                          onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                          placeholder="Add a comment..."
                          rows={2}
                          className="flex-1"
                        />
                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => handleAddComment(post.id)}>
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setCommentingOn(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCommentingOn(post.id)}
                        className="gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Comment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourtBoard;
