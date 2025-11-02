import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, Users } from "lucide-react";

interface PostComposerProps {
  courtId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: () => void;
}

export const PostComposer = ({ courtId, open, onOpenChange, onPostCreated }: PostComposerProps) => {
  const [type, setType] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Use existing court_posts schema for now (backward compatible)
      const postData: any = {
        court_id: courtId,
        user_id: user.id,
        type, // Save the post type
        title,
        content: body, // Map body to content for existing schema
        body, // Also save as body for new schema
        status: "open",
      };

      // Add LFG-specific fields and metadata
      if (type === "lfg") {
        postData.session_date = sessionDate;
        postData.session_time = sessionTime;
        postData.max_players = parseInt(maxPlayers);
        postData.metadata = {
          session_date: sessionDate,
          session_time: sessionTime,
          max_players: parseInt(maxPlayers),
        };
      }

      const { error } = await supabase
        .from("court_posts")
        .insert(postData);

      if (error) throw error;

      toast.success("Post created successfully!");
      onPostCreated();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error(error.message || "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setType("general");
    setTitle("");
    setBody("");
    setSessionDate("");
    setSessionTime("");
    setMaxPlayers("4");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a Post</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Post Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Post Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Discussion</SelectItem>
                <SelectItem value="lfg">Looking for Game</SelectItem>
                <SelectItem value="highlight">Highlight/Achievement</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a clear title..."
              required
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Details</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share more details..."
              rows={6}
              required
            />
          </div>

          {/* LFG-specific fields */}
          {type === "lfg" && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm">Game Details</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="session_date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                  </Label>
                  <Input
                    id="session_date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session_time" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time
                  </Label>
                  <Input
                    id="session_time"
                    type="time"
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_players" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Players Needed
                </Label>
                <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 player</SelectItem>
                    <SelectItem value="2">2 players</SelectItem>
                    <SelectItem value="3">3 players</SelectItem>
                    <SelectItem value="4">4 players</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Post"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};